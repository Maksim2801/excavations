import { html, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { dictionariesApi, excavationsApi, layersApi, reportsApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { COLUMN_LABELS, EXTENDED_COLUMNS, MINIMAL_COLUMNS, METHOD_LABELS, allow } from "./labels.js";
import { cleanReport, reportFromURL, restoreTemplate, META, SORT_KEYS, LAYOUTS } from "./reportState.js";
import { Breadcrumbs, ErrorText, Field, SectionHeading } from "./ui.js";

export function ReportsPage() {
  const { user } = useSession();
  const { search } = useRouter();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const [form, setForm] = useState(() => ({ excavation_id: workspace.excavationId, layer_id: workspace.layerId, title: "", layout: "working", sort: "number", order: "asc", columns: MINIMAL_COLUMNS, ...reportFromURL(search) }));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const excavations = useQuery(() => excavationsApi.list(), []);
  const dictionaries = useQuery(() => dictionariesApi.list(), []);
  const templates = useQuery(() => reportsApi.templates(), []);
  const reports = useQuery(() => reportsApi.list(), []);
  const layers = useQuery(() => form.excavation_id ? layersApi.list(form.excavation_id) : Promise.resolve([]), [form.excavation_id]);
  const columns = form.columns || MINIMAL_COLUMNS;
  const layout = form.layout || "working";
  const formal = layout === "field" || layout === "collection";
  const album = layout === "album";
  const working = layout === "working";
  const change = (key, value) => { setForm((current) => ({ ...current, [key]: value, ...(key === "excavation_id" ? { layer_id: "" } : {}) })); setPreview(null); };
  const payload = () => cleanReport(form);
  const perform = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(err); setStatus(err.message, "error"); }
    finally { setBusy(false); }
  };
  const textField = (key, label, type = "text") => html`<${Field} key=${key} label=${label}><input type=${type} step=${type === "number" ? "any" : undefined} value=${form[key] ?? ""} onInput=${(e) => change(key, e.target.value)} /></${Field}>`;
  const canExport = allow(user, 2);
  const run = (format) => perform(async () => {
    if (format === "print") await reportsApi.print(payload());
    else {
      const result = await reportsApi.exportFile({ ...payload(), format });
      if (result?.preview) await reportsApi.print(payload());
      reports.reload();
    }
    setStatus(format === "print" ? "Открыта печать" : (album ? "Альбом сформирован" : "Опись сформирована"), "ok");
  });
  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Опись", href: "/inventory" }, { label: "Отчёты" }]} />
    <${SectionHeading}>Отчёты<//>
    <${ErrorText} error=${error || reports.error} />
    <form className="stack" onSubmit=${(e) => { e.preventDefault(); perform(async () => setPreview(await reportsApi.preview(payload()))); }}>
      ${form.ids ? html`<p>Экспорт отмеченных записей (${form.ids.length}) с учётом фильтров. <button type="button" className="btn btn-text" onClick=${() => change("ids", undefined)}>Все записи по фильтрам</button></p>` : null}
      <div className="actions">
        ${Object.entries(LAYOUTS).map(([key, label]) => html`<button type="button" key=${key} className=${"btn " + (layout === key ? "btn-gold" : "btn-line")} onClick=${() => change("layout", key)}>${label}</button>`)}
      </div>
      <div className="filter-grid">
        <${Field} label="Раскоп"><select value=${form.excavation_id || ""} onChange=${(e) => change("excavation_id", e.target.value)}><option value="">Все</option>${(excavations.data || []).map((ex) => html`<option key=${ex.id} value=${ex.id}>${ex.code} (${ex.year})</option>`)}</select></${Field}>
        <${Field} label="Пласт"><select value=${form.layer_id || ""} onChange=${(e) => change("layer_id", e.target.value)}><option value="">Все</option>${(layers.data || []).map((layer) => html`<option key=${layer.id} value=${layer.id}>Пласт ${layer.number}</option>`)}</select></${Field}>
        ${textField("q", "Поиск")}${textField("code", "Код")}${textField("square", "Квадрат")}${textField("find_type", "Тип находки")}
        <${Field} label="Материал"><select value=${form.material || ""} onChange=${(e) => change("material", e.target.value)}><option value="">Все</option>${(dictionaries.data?.materials || []).map((item) => html`<option key=${item.id} value=${item.name}>${item.name}</option>`)}</select></${Field}>
        <${Field} label="Способ"><select value=${form.measurement_method || ""} onChange=${(e) => change("measurement_method", e.target.value)}><option value="">Все</option>${Object.entries(METHOD_LABELS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}</select></${Field}>
        <${Field} label="Фото"><select value=${form.photo_present === undefined ? "" : String(form.photo_present)} onChange=${(e) => change("photo_present", e.target.value)}><option value="">Все</option><option value="true">Есть</option><option value="false">Нет</option></select></${Field}>
        ${textField("number_from", "Номер от", "number")}${textField("number_to", "Номер до", "number")}
        ${textField("elev_from", "Elev от", "number")}${textField("elev_to", "Elev до", "number")}
        ${textField("date_from", "Регистрация с (UTC)", "date")}${textField("date_to", "Регистрация по (UTC)", "date")}
        <${Field} label="Сортировка"><select value=${form.sort || "number"} onChange=${(e) => change("sort", e.target.value)}>${SORT_KEYS.map((key) => html`<option key=${key} value=${key}>${COLUMN_LABELS[key] || ({ combined: "Пласт, квадрат, номер", record_status: "Состояние", created_at: "Дата регистрации" })[key] || key}</option>`)}</select></${Field}>
        <${Field} label="Порядок"><select value=${form.order || "asc"} onChange=${(e) => change("order", e.target.value)}><option value="asc">По возрастанию</option><option value="desc">По убыванию</option></select></${Field}>
        ${textField("title", "Заголовок (необязательно)")}
      </div>
      ${!album ? html`<details><summary>Реквизиты описи</summary><div className="filter-grid">${Object.entries(META).map(([key, label]) => textField(key, label))}</div>
        ${formal ? html`<p>Для официальной описи заполните номер, дату, блок «УТВЕРЖДАЮ» и реквизиты коллекции. Колонка «Сохранность» в коллекционной описи остаётся пустой для ручного заполнения.</p>` : null}
      </details>` : html`<details open><summary>Реквизиты альбома (идут в титул и подписи)</summary><div className="filter-grid">
        ${textField("title", "Заголовок альбома")}
        ${textField("monument", "Памятник / ОАН")}
        ${textField("place_time", "Место и время работ")}
        ${textField("excavation_author", "Автор раскопок")}
        ${textField("collection_name", "Коллекция")}
        ${textField("dating", "Датировка")}
        ${textField("culture", "Культурная принадлежность")}
        ${textField("source", "Основание работ")}
        ${textField("report_note", "Примечание")}
      </div>
        <p>Без реквизитов на страницах останутся только фото. Заполните памятник и место — подписи станут как в научном альбоме. Excel недоступен.</p>
      </details>`}
      ${working ? html`<div className="actions">
        <button type="button" className="btn btn-line" onClick=${() => change("columns", MINIMAL_COLUMNS)}>Минимальная опись</button>
        <button type="button" className="btn btn-line" onClick=${() => change("columns", EXTENDED_COLUMNS)}>Расширенная опись</button>
        ${(templates.data || []).map((item) => html`<button type="button" key=${item.id} className="btn btn-text" onClick=${() => { setForm({ title: "", layout: "working", sort: "number", order: "asc", columns: MINIMAL_COLUMNS, ...restoreTemplate(item) }); setPreview(null); }}>${item.name}</button>`)}
      </div>
      <div className="checks">${Object.entries(COLUMN_LABELS).map(([key, label]) => html`<label key=${key}><input type="checkbox" aria-label=${`Колонка ${label}`} checked=${columns.includes(key)} disabled=${columns.length === 1 && columns.includes(key)} onChange=${(e) => change("columns", e.target.checked ? [...columns, key] : columns.filter((item) => item !== key))} /> ${label}</label>`)}</div>` : null}
      ${formal ? html`<p>${layout === "field" ? "Фиксированные колонки полевой описи: наименование, количество, материал, квадрат, пласт, примечание." : "Фиксированные колонки коллекционной описи, включая размеры (см) и полевой шифр."}</p>` : null}
      <div className="actions">
        <button disabled=${busy || !canExport} type="submit" className="btn btn-gold">Показать</button>
        ${!album ? html`<button disabled=${busy || !canExport} type="button" className="btn btn-line" onClick=${() => run("xlsx")}>Excel</button>` : null}
        <button disabled=${busy || !canExport} type="button" className="btn btn-line" onClick=${() => run("pdf")}>PDF</button>
        <button disabled=${busy || !canExport} type="button" className="btn btn-line" onClick=${() => run("print")}>Печать</button>
        ${!album ? html`<button disabled=${busy || !canExport} type="button" className="btn btn-text" onClick=${() => {
          const name = window.prompt("Название шаблона"); if (!name?.trim()) return;
          perform(async () => { const data = payload(); const { ids, ...reusable } = data; await reportsApi.saveTemplate({ name, filters: reusable, columns, sort: { sort: data.sort, order: data.order } }); templates.reload(); setStatus("Шаблон сохранён", "ok"); });
        }}>Сохранить шаблон</button>` : null}
      </div>
    </form>
    ${preview ? html`<div><p>Всего: ${preview.total}. Вид: ${LAYOUTS[preview.layout] || LAYOUTS[layout]}. ${album ? "Список иллюстраций для PDF/печати." : `Предпросмотр: первые ${preview.preview_limit || 100} записей; экспорт включает всю выборку.`}</p><div className="table-wrap"><table><thead><tr>${preview.columns.map((c) => html`<th key=${c.key}>${c.label}</th>`)}</tr></thead><tbody>${preview.rows.map((row, i) => html`<tr key=${i}>${(Array.isArray(row) ? row : row.cells).map((cell, j) => html`<td key=${j}>${cell}</td>`)}</tr>`)}</tbody></table></div></div>` : null}
    <h3 className="subhead">Сформированные отчёты</h3>
    <div className="table-wrap"><table><thead><tr><th>№</th><th>Название</th><th>Формат</th><th>Статус</th><th></th></tr></thead><tbody>
      ${(reports.data || []).map((item) => html`<tr key=${item.id}><td>${item.id}</td><td>${item.title}</td><td>${item.format}</td><td>${item.confirmed || item.status === "confirmed" ? "подтверждена" : "черновик"}</td><td>${allow(user, 3) && !(item.confirmed || item.status === "confirmed") ? html`<button type="button" className="btn btn-text" onClick=${() => perform(async () => { await reportsApi.confirm(item.id); reports.reload(); })}>Подтвердить</button>` : null}</td></tr>`)}
    </tbody></table></div>
  </section>`;
}
