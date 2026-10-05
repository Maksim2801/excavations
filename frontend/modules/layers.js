import { html, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { excavationsApi, layersApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { LAYER_STATUS, allow, fmt } from "./labels.js";
import { Breadcrumbs, ConfirmDialog, ErrorText, Field, Modal, SectionHeading } from "./ui.js";

const EMPTY = { number: "", top_elev: "", bottom_elev: "", description: "", color: "", status: "open", surface_description: "", inclusions: "", interpretation: "", note: "" };

export function LayersPage() {
  const { user } = useSession();
  const { excavationId, setExcavationId, setLayerId } = useWorkspace();
  const { setStatus } = useStatus();
  const [editor, setEditor] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [error, setError] = useState(null);
  const excavations = useQuery(() => excavationsApi.list(), []);
  const layers = useQuery(() => (excavationId ? layersApi.list(excavationId) : Promise.resolve([])), [excavationId]);

  const save = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    data.excavation_id = Number(excavationId);
    setError(null);
    try {
      if (editor.id) await layersApi.update(editor.id, data);
      else await layersApi.create(data);
      setStatus("Пласт сохранён", "ok");
      setEditor(null);
      layers.reload();
    } catch (err) {
      setError(err);
      setStatus(err.message, "error");
    }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "Пласты" }]} />
    <${SectionHeading}>Пласты<//>
    <div className="filter-strip">
      <div className="filter-bar">
        <label>Раскоп <select value=${excavationId} onChange=${(event) => setExcavationId(event.target.value)}>
          <option value="">Выберите</option>
          ${(excavations.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code} (${item.year})</option>`)}
        </select></label>
        ${allow(user, 1) && excavationId ? html`<button type="button" className="btn btn-gold" onClick=${() => setEditor({ ...EMPTY })}>Новый пласт</button>` : null}
      </div>
    </div>
    ${!allow(user, 2) ? html`<p className="muted">Править описание и закрывать пласт могут камеральный сотрудник и руководитель. Полевой археолог может добавить пласт.</p>` : null}
    <${ErrorText} error=${layers.error} />
    <div className="table-wrap"><table>
      <thead><tr><th>№</th><th>Описание</th><th>Верх</th><th>Низ</th><th>Статус</th><th>Находки</th><th></th></tr></thead>
      <tbody>
        ${(layers.data || []).map((layer) => html`<tr key=${layer.id}>
          <td>${layer.number}</td>
          <td>${layer.description || "—"}<br /><span className="muted">${layer.surface_description || ""}</span></td>
          <td>${fmt(layer.top_elev)}</td>
          <td>${fmt(layer.bottom_elev)}</td>
          <td>${LAYER_STATUS[layer.status] || layer.status}</td>
          <td>${layer.finding_count}</td>
          <td className="actions">
            <button type="button" className="btn btn-text" onClick=${() => { setLayerId(layer.id); setStatus(`Пласт ${layer.number} выбран`, "ok"); }}>В опись</button>
            ${allow(user, 2) ? html`<button type="button" className="btn btn-text" onClick=${() => setEditor(layer)}>Править</button>` : null}
            ${allow(user, 2) ? html`<button type="button" className="btn btn-text danger" onClick=${() => setRemoveId(layer.id)}>Удалить</button>` : null}
          </td>
        </tr>`)}
        ${!(layers.data || []).length ? html`<tr><td colspan="7">Пластов нет</td></tr>` : null}
      </tbody>
    </table></div>
    ${editor ? html`<${Modal} title=${editor.id ? "Пласт" : "Новый пласт"} onClose=${() => setEditor(null)}>
      <form className="stack" key=${editor.id || "new"} onSubmit=${save}>
        <${Field} label="Номер"><input name="number" type="number" min="1" required defaultValue=${editor.number} /></${Field}>
        <${Field} label="Верхняя отметка"><input name="top_elev" type="number" step="0.001" required defaultValue=${editor.top_elev} /></${Field}>
        <${Field} label="Нижняя отметка"><input name="bottom_elev" type="number" step="0.001" required defaultValue=${editor.bottom_elev} /></${Field}>
        <${Field} label="Описание"><input name="description" defaultValue=${editor.description || ""} /></${Field}>
        <${Field} label="Цвет"><input name="color" defaultValue=${editor.color || ""} /></${Field}>
        <${Field} label="Статус"><select name="status" defaultValue=${editor.status || "open"}>${Object.entries(LAYER_STATUS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}</select></${Field}>
        <${Field} label="Поверхность"><textarea name="surface_description" defaultValue=${editor.surface_description || ""}></textarea></${Field}>
        <${Field} label="Включения"><input name="inclusions" defaultValue=${editor.inclusions || ""} /></${Field}>
        <${Field} label="Интерпретация"><input name="interpretation" defaultValue=${editor.interpretation || ""} /></${Field}>
        <${Field} label="Примечание"><textarea name="note" defaultValue=${editor.note || ""}></textarea></${Field}>
        <${ErrorText} error=${error} />
        <div className="actions"><button className="btn btn-gold" type="submit" disabled=${editor.id && !allow(user, 2)}>Сохранить</button></div>
      </form>
    <//>` : null}
    ${removeId ? html`<${ConfirmDialog} title="Удалить пласт" text="Пласт без находок будет удалён." confirmLabel="Удалить" onClose=${() => setRemoveId(null)} onConfirm=${async () => {
      try {
        await layersApi.remove(removeId);
        setRemoveId(null);
        setStatus("Пласт удалён", "ok");
        layers.reload();
      } catch (err) {
        setStatus(err.message, "error");
        setRemoveId(null);
      }
    }} />` : null}
  </section>`;
}
