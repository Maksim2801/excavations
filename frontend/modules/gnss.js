import { html, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { excavationsApi, gnssApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { GNSS_LABELS, allow, fmt } from "./labels.js";
import { Breadcrumbs, ErrorText, Field, SectionHeading } from "./ui.js";

export function GnssPage() {
  const { user } = useSession();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const [excavationId, setExcavationId] = useState(workspace.excavationId);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const excavations = useQuery(() => excavationsApi.list(), []);
  const chosen = excavationId || excavations.data?.[0]?.id || "";
  const points = useQuery(() => (chosen ? gnssApi.list(chosen) : Promise.resolve([])), [chosen]);

  const check = async (event) => {
    event.preventDefault();
    const file = event.target.file.files[0];
    const id = event.target.excavation_id.value;
    setExcavationId(id);
    workspace.setExcavationId(id);
    setStatus("Проверка CSV…");
    try {
      const result = await gnssApi.preview(id, file);
      setFileName(file.name);
      setPreview(result.rows.map((row) => ({ ...row, selected: row.status === "ok" })));
      setStatus(`Корректных строк: ${result.valid_count}, с ошибками: ${result.error_count}`, result.error_count ? "warn" : "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  const commit = async () => {
    const rows = (preview || []).filter((row) => row.selected && row.status === "ok");
    if (!rows.length) {
      setStatus("Нет строк для импорта", "warn");
      return;
    }
    try {
      const result = await gnssApi.import({
        excavation_id: Number(chosen),
        source_name: fileName,
        points: rows.map((row) => ({ north: row.north, east: row.east, elev: row.elev, point_type: row.point_type, comment: row.comment })),
      });
      setPreview(null);
      setStatus(`Импортировано точек: ${result.imported}`, "ok");
      points.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "GNSS" }]} />
    <${SectionHeading}>Импорт GNSS<//>
    <form className="filter-bar" onSubmit=${check}>
      <${Field} label="Раскоп"><select name="excavation_id" value=${chosen} onChange=${(event) => { setExcavationId(event.target.value); workspace.setExcavationId(event.target.value); }}>
        ${(excavations.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code} (${item.year})</option>`)}
      </select></${Field}>
      <${Field} label="CSV"><input name="file" type="file" accept=".csv,text/csv" required /></${Field}>
      <button className="btn btn-gold" type="submit">Проверить файл</button>
    </form>
    <p className="muted">Колонки: north, east, elev, point_type, comment. Типы: corner / control / auxiliary или угловая / контрольная / вспомогательная.</p>
    <${ErrorText} error=${points.error} />
    ${preview ? html`<div className="stack">
      <div className="table-wrap"><table>
        <thead><tr><th></th><th>Строка</th><th>North</th><th>East</th><th>Elev</th><th>Тип</th><th>Комментарий</th><th>Статус</th></tr></thead>
        <tbody>
          ${preview.map((row, index) => html`<tr key=${row.line} className=${row.status === "error" ? "problem" : ""}>
            <td><input type="checkbox" checked=${row.selected} disabled=${row.status === "error"} onChange=${(event) => setPreview((current) => current.map((item, at) => at === index ? { ...item, selected: event.target.checked } : item))} /></td>
            <td>${row.line}</td><td>${row.north ?? ""}</td><td>${row.east ?? ""}</td><td>${row.elev ?? ""}</td>
            <td><select value=${row.point_type} onChange=${(event) => setPreview((current) => current.map((item, at) => at === index ? { ...item, point_type: event.target.value } : item))}>
              ${Object.entries(GNSS_LABELS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}
            </select></td>
            <td><input value=${row.comment || ""} onInput=${(event) => setPreview((current) => current.map((item, at) => at === index ? { ...item, comment: event.target.value } : item))} /></td>
            <td>${row.status === "ok" ? "ok" : row.errors.join("; ")}</td>
          </tr>`)}
        </tbody>
      </table></div>
      <div className="actions"><button type="button" className="btn btn-gold" onClick=${commit}>Подтвердить импорт</button></div>
    </div>` : null}
    <h3 className="subhead">Точки раскопа</h3>
    <div className="table-wrap"><table>
      <thead><tr><th>North</th><th>East</th><th>Elev</th><th>Тип</th><th>Комментарий</th><th></th></tr></thead>
      <tbody>
        ${(points.data || []).map((point) => html`<tr key=${point.id}>
          <td>${fmt(point.north)}</td><td>${fmt(point.east)}</td><td>${fmt(point.elev)}</td>
          <td>${point.point_type_label}</td><td>${point.comment || ""}</td>
          <td>${allow(user, 2) ? html`<button type="button" className="btn btn-text danger" onClick=${async () => { await gnssApi.remove(point.id); points.reload(); }}>Удалить</button>` : null}</td>
        </tr>`)}
        ${!(points.data || []).length ? html`<tr><td colspan="6">Точек нет</td></tr>` : null}
      </tbody>
    </table></div>
  </section>`;
}
