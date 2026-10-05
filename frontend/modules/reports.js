import { html, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { dictionariesApi, excavationsApi, layersApi, reportsApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { COLUMN_LABELS, EXTENDED_COLUMNS, MINIMAL_COLUMNS, allow } from "./labels.js";
import { Breadcrumbs, ErrorText, Field, SectionHeading } from "./ui.js";

const COLUMNS = Object.entries(COLUMN_LABELS);

export function ReportsPage() {
  const { user } = useSession();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const [columns, setColumns] = useState(MINIMAL_COLUMNS);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState("Полевая опись");
  const excavations = useQuery(() => excavationsApi.list(), []);
  const dictionaries = useQuery(() => dictionariesApi.list(), []);
  const templates = useQuery(() => reportsApi.templates(), []);
  const reports = useQuery(() => reportsApi.list(), []);
  const [excavationId, setExcavationId] = useState(workspace.excavationId);
  const layers = useQuery(() => (excavationId ? layersApi.list(excavationId) : Promise.resolve([])), [excavationId]);

  const payloadFrom = (form) => {
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach((key) => { if (data[key] === "") delete data[key]; });
    return { ...data, columns, title, preset: columns.join() === EXTENDED_COLUMNS.join() ? "extended" : "minimal" };
  };

  const build = async (event) => {
    event.preventDefault();
    try {
      const data = await reportsApi.preview(payloadFrom(event.target));
      setPreview(data);
      setStatus(`В описи ${data.total} записей`, "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  const run = async (format) => {
    const form = document.getElementById("report-form");
    const body = { ...payloadFrom(form), format };
    try {
      if (format === "print") {
        await reportsApi.print(body);
        setStatus("Печать открыта", "ok");
        return;
      }
      const reportId = await reportsApi.exportFile(body);
      if (format === "pdf" && reportId?.preview) await reportsApi.print({ ...body, title });
      setStatus(format === "pdf" && reportId?.preview ? "PDF открыт через печать" : format === "pdf" ? "Файл PDF сохранён" : "Файл Excel сохранён", "ok");
      reports.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Опись", href: "/inventory" }, { label: "Отчёты" }]} />
    <${SectionHeading}>Отчёты<//>
    ${allow(user, 2) ? null : html`<p>Выгружать описи могут камеральный сотрудник и руководитель.</p>`}
    <form id="report-form" className="stack" onSubmit=${build}>
      <div className="filter-grid">
        <${Field} label="Раскоп"><select name="excavation_id" value=${excavationId} onChange=${(event) => setExcavationId(event.target.value)}>
          <option value="">Все</option>
          ${(excavations.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code} (${item.year})</option>`)}
        </select></${Field}>
        <${Field} label="Пласт"><select name="layer_id" defaultValue=${workspace.layerId}>
          <option value="">Все</option>
          ${(layers.data || []).map((item) => html`<option key=${item.id} value=${item.id}>Пласт ${item.number}</option>`)}
        </select></${Field}>
        <${Field} label="Квадрат"><input name="square" /></${Field}>
        <${Field} label="Материал"><select name="material">
          <option value="">Все</option>
          ${(dictionaries.data?.materials || []).map((item) => html`<option key=${item.id} value=${item.name}>${item.name}</option>`)}
        </select></${Field}>
        <${Field} label="Тип находки"><input name="find_type" /></${Field}>
        <${Field} label="Способ"><select name="measurement_method"><option value="">Все</option><option value="photo">по фото</option><option value="manual">ручное</option><option value="none">не указан</option></select></${Field}>
        <${Field} label="Номер от"><input name="number_from" type="number" /></${Field}>
        <${Field} label="Номер до"><input name="number_to" type="number" /></${Field}>
        <${Field} label="Elev от"><input name="elev_from" type="number" step="0.001" /></${Field}>
        <${Field} label="Elev до"><input name="elev_to" type="number" step="0.001" /></${Field}>
        <${Field} label="Сортировка"><select name="sort"><option value="number">по номеру</option><option value="square">по квадрату</option><option value="layer">по пласту</option><option value="code">по коду</option></select></${Field}>
        <${Field} label="Заголовок"><input value=${title} onInput=${(event) => setTitle(event.target.value)} /></${Field}>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-line" onClick=${() => setColumns(MINIMAL_COLUMNS)}>Минимальная опись</button>
        <button type="button" className="btn btn-line" onClick=${() => setColumns(EXTENDED_COLUMNS)}>Расширенная опись</button>
        ${(templates.data || []).map((item) => html`<button type="button" key=${item.id} className="btn btn-text" onClick=${() => setColumns(item.columns)}>${item.name}</button>`)}
      </div>
      <div className="checks">
        ${COLUMNS.map(([key, label]) => html`<label key=${key} className="check"><input type="checkbox" checked=${columns.includes(key)} onChange=${(event) => setColumns((current) => event.target.checked ? current.concat(key) : current.filter((item) => item !== key))} /> ${label}</label>`)}
      </div>
      <div className="actions">
        <button className="btn btn-gold" type="submit">Показать</button>
        <button type="button" className="btn btn-line" onClick=${() => run("xlsx")}>Excel</button>
        <button type="button" className="btn btn-line" onClick=${() => run("pdf")}>PDF</button>
        <button type="button" className="btn btn-line" onClick=${() => run("print")}>Печать</button>
        <button type="button" className="btn btn-text" onClick=${async () => {
          const name = window.prompt("Название шаблона");
          if (!name) return;
          const form = document.getElementById("report-form");
          await reportsApi.saveTemplate({ name, filters: payloadFrom(form), columns, sort: { sort: "number", order: "asc" } });
          templates.reload();
          setStatus("Шаблон сохранён", "ok");
        }}>Сохранить шаблон</button>
      </div>
    </form>
    <${ErrorText} error=${reports.error} />
    ${preview ? html`<div className="table-wrap"><table>
      <thead><tr>${preview.columns.map((column) => html`<th key=${column.key}>${column.label}</th>`)}</tr></thead>
      <tbody>${preview.rows.map((row, index) => {
        const cells = Array.isArray(row) ? row : row.cells;
        const key = row.id ?? index;
        return html`<tr key=${key}>${cells.map((cell, cellIndex) => html`<td key=${cellIndex}>${cell}</td>`)}</tr>`;
      })}</tbody>
    </table></div>` : null}
    <h3 className="subhead">Сформированные описи</h3>
    <div className="table-wrap"><table>
      <thead><tr><th>№</th><th>Название</th><th>Формат</th><th>Записей</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${(reports.data || []).map((item) => html`<tr key=${item.id}>
          <td>${item.id}</td><td>${item.title}</td><td>${item.format}</td>          <td>${item.total ?? "—"}</td>
          <td>${item.confirmed || item.status === "confirmed" ? "подтверждена" : "черновик"}</td>
          <td>${allow(user, 3) && !(item.confirmed || item.status === "confirmed") ? html`<button type="button" className="btn btn-text" onClick=${async () => { await reportsApi.confirm(item.id); setStatus("Опись подтверждена", "ok"); reports.reload(); }}>Подтвердить</button>` : null}</td>
        </tr>`)}
        ${!(reports.data || []).length ? html`<tr><td colspan="6">Описей ещё нет. Excel и PDF создают запись, которую подтверждает руководитель.</td></tr>` : null}
      </tbody>
    </table></div>
  </section>`;
}
