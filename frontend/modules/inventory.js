import { html, useEffect, useMemo, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { dictionariesApi, excavationsApi, findingsApi, layersApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { METHOD_LABELS, allow, fmt, issueText } from "./labels.js";
import { Breadcrumbs, ConfirmDialog, ErrorText, Field, Pagination, SectionHeading } from "./ui.js";

import { reportURL } from "./reportState.js";

const SORTS = [["code", "Код"], ["number", "Номер"], ["north", "North"], ["east", "East"], ["elev", "Elev"], ["length_mm", "Длина"], ["width_mm", "Ширина"], ["thickness_mm", "Толщина"], ["excavation", "Раскоп"], ["layer", "Пласт"], ["material", "Материал"], ["square", "Квадрат"], ["measurement_method", "Способ"], ["photo_present", "Фото"], ["record_status", "Замечания"], ["created_at", "Дата регистрации"]];

export function InventoryPage() {
  const { user } = useSession();
  const { navigate, search } = useRouter();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("code");
  const [order, setOrder] = useState("asc");
  const [removeId, setRemoveId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [visible, setVisible] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem("inventory-columns")); if (saved?.length) return saved.filter((key) => SORTS.some(([k]) => k === key)); } catch {}
    return SORTS.map(([key]) => key);
  });
  useEffect(() => { localStorage.setItem("inventory-columns", JSON.stringify(visible)); }, [visible]);
  const cell = (item, key) => {
    if (key === "excavation") return item.excavation_code;
    if (key === "layer") return item.layer_number ?? "—";
    if (key === "measurement_method") return METHOD_LABELS[item[key]];
    if (key === "photo_present") return item[key] ? "да" : "нет";
    if (key === "record_status") return issueText(item.issues);
    if (key === "created_at") return item[key]?.slice(0, 10);
    if (["north", "east", "elev"].includes(key)) return fmt(item[key]);
    if (key.endsWith("_mm")) return fmt(item[key], 1);
    return item[key] ?? "—";
  };
  const [filters, setFilters] = useState(() => ({
    excavation_id: workspace.excavationId,
    layer_id: workspace.layerId,
    q: search.get("q") || "",
    code: "",
    material: "",
    square: "",
    measurement_method: "",
    photo_present: "",
    number_from: "",
    number_to: "",
    elev_from: "",
    elev_to: "",
    date_from: "", date_to: "", find_type: "",
  }));
  const excavations = useQuery(() => excavationsApi.list(), []);
  const layers = useQuery(() => (filters.excavation_id ? layersApi.list(filters.excavation_id) : Promise.resolve([])), [filters.excavation_id]);
  const dictionaries = useQuery(() => dictionariesApi.list(), []);
  const params = useMemo(() => ({ ...filters, page, page_size: 12, sort, order }), [filters, page, sort, order]);
  const findings = useQuery(() => findingsApi.list(params), [JSON.stringify(params)]);
  const pages = Math.max(1, Math.ceil((findings.data?.total || 0) / 12));

  const setFilter = (name, value) => {
    setPage(1);
    setSelected([]);
    setFilters((current) => ({ ...current, [name]: value, ...(name === "excavation_id" ? { layer_id: "" } : {}) }));
    if (name === "excavation_id") workspace.setExcavationId(value);
    if (name === "layer_id") workspace.setLayerId(value);
  };

  const toggleSort = (key) => {
    if (sort === key) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(key); setOrder("asc"); }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "Опись" }]} />
    <div className="title-row">
      <${SectionHeading}>Опись<//>
      <button type="button" className="btn btn-gold" onClick=${() => navigate("/findings/new")}>Новая находка</button>
      ${allow(user, 2) ? html`<button type="button" className="btn btn-line" onClick=${() => navigate(reportURL(filters, sort, order, selected))}>Экспорт ${selected.length ? `(${selected.length})` : "выборки"}</button>` : null}
    </div>
    <form className="filter-strip" onSubmit=${(event) => event.preventDefault()}>
      <div className="filter-grid">
        <${Field} label="Раскоп"><select value=${filters.excavation_id} onChange=${(event) => setFilter("excavation_id", event.target.value)}>
          <option value="">Все</option>
          ${(excavations.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code} (${item.year})</option>`)}
        </select></${Field}>
        <${Field} label="Пласт"><select value=${filters.layer_id} onChange=${(event) => setFilter("layer_id", event.target.value)}>
          <option value="">Все</option>
          ${(layers.data || []).map((item) => html`<option key=${item.id} value=${item.id}>Пласт ${item.number}</option>`)}
        </select></${Field}>
        <${Field} label="Поиск"><input value=${filters.q} placeholder="код, описание, квадрат" onInput=${(event) => setFilter("q", event.target.value)} /></${Field}>
        <${Field} label="Код"><input value=${filters.code} onInput=${(event) => setFilter("code", event.target.value)} /></${Field}>
        <${Field} label="Материал"><select value=${filters.material} onChange=${(event) => setFilter("material", event.target.value)}>
          <option value="">Все</option>
          ${(dictionaries.data?.materials || []).filter((item) => item.is_active).map((item) => html`<option key=${item.id} value=${item.name}>${item.name}</option>`)}
        </select></${Field}>
        <${Field} label="Квадрат"><input value=${filters.square} onInput=${(event) => setFilter("square", event.target.value)} /></${Field}>
        <${Field} label="Способ"><select value=${filters.measurement_method} onChange=${(event) => setFilter("measurement_method", event.target.value)}>
          <option value="">Все</option>
          ${Object.entries(METHOD_LABELS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}
        </select></${Field}>
        <${Field} label="Фото"><select value=${filters.photo_present} onChange=${(event) => setFilter("photo_present", event.target.value)}>
          <option value="">Все</option><option value="true">Есть</option><option value="false">Нет</option>
        </select></${Field}>
        <${Field} label="Номер от"><input type="number" value=${filters.number_from} onInput=${(event) => setFilter("number_from", event.target.value)} /></${Field}>
        <${Field} label="Номер до"><input type="number" value=${filters.number_to} onInput=${(event) => setFilter("number_to", event.target.value)} /></${Field}>
        <${Field} label="Elev от"><input type="number" step="0.001" value=${filters.elev_from} onInput=${(event) => setFilter("elev_from", event.target.value)} /></${Field}>
        <${Field} label="Elev до"><input type="number" step="0.001" value=${filters.elev_to} onInput=${(event) => setFilter("elev_to", event.target.value)} /></${Field}>
        <${Field} label="Тип находки"><input value=${filters.find_type || ""} onInput=${(e) => setFilter("find_type", e.target.value)} /></${Field}>
        <${Field} label="Регистрация с (UTC)"><input type="date" value=${filters.date_from || ""} onInput=${(e) => setFilter("date_from", e.target.value)} /></${Field}>
        <${Field} label="Регистрация по (UTC)"><input type="date" value=${filters.date_to || ""} onInput=${(e) => setFilter("date_to", e.target.value)} /></${Field}>
        <button type="button" className="reset-link" onClick=${() => { setPage(1); setSelected([]); setFilters({ excavation_id: "", layer_id: "", q: "", code: "", material: "", square: "", measurement_method: "", photo_present: "", number_from: "", number_to: "", elev_from: "", elev_to: "", date_from: "", date_to: "", find_type: "" }); }}>Сбросить</button>
      </div>
    </form>
    <${ErrorText} error=${findings.error} />
    <details><summary>Колонки таблицы</summary><div className="checks">
      ${SORTS.map(([key, label]) => html`<label key=${key}><input type="checkbox" aria-label=${`Колонка ${label}`} checked=${visible.includes(key)} disabled=${visible.length === 1 && visible.includes(key)} onChange=${(e) => setVisible((items) => e.target.checked ? [...items, key] : items.filter((k) => k !== key))} /> ${label}</label>`)}
    </div></details>
    ${selected.length ? html`<p>Отмечено: ${selected.length}. <button className="btn btn-text" onClick=${() => setSelected([])}>Снять выделение</button></p>` : null}
    <div className="table-wrap"><table>
      <thead><tr><th>Выбрать</th>
        ${SORTS.filter(([key]) => visible.includes(key)).map(([key, label]) => html`<th key=${key}><button type="button" className="sort" onClick=${() => toggleSort(key)}>${label}${sort === key ? (order === "asc" ? " ↑" : " ↓") : ""}</button></th>`)}
        <th>Действия</th>
      </tr></thead>
      <tbody>
        ${(findings.data?.items || []).map((item) => html`<tr key=${item.id} className=${item.issues?.length ? "problem" : ""}>
          <td><input type="checkbox" aria-label=${`Выбрать ${item.code}`} checked=${selected.includes(item.id)} onChange=${(e) => setSelected((ids) => e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} /></td>
          ${SORTS.filter(([key]) => visible.includes(key)).map(([key]) => html`<td key=${key}>${cell(item, key)}</td>`)}
          <td className="actions">
            <button type="button" className="btn btn-text" onClick=${() => navigate(`/findings/${item.id}`)}>Карточка</button>
            <button type="button" className="btn btn-text" onClick=${() => navigate(`/photo/${item.id}`)}>Фото</button>
            <button type="button" className="btn btn-text" onClick=${() => { workspace.setExcavationId(item.excavation_id); if (item.layer_id) workspace.setLayerId(item.layer_id); navigate(`/plan?finding=${item.id}`); }}>План</button>
            ${allow(user, 2) ? html`<button type="button" className="btn btn-text danger" onClick=${() => setRemoveId(item.id)}>Удалить</button>` : null}
          </td>
        </tr>`)}
        ${!(findings.data?.items || []).length && !findings.loading ? html`<tr><td colspan=${visible.length + 2}>Записей нет</td></tr>` : null}
      </tbody>
    </table></div>
    <p className="muted">Стр. ${findings.data?.page || page}, всего ${findings.data?.total || 0}</p>
    <${Pagination} page=${page} pages=${pages} onPage=${setPage} />
    ${removeId ? html`<${ConfirmDialog} title="Удалить находку" text="Запись будет убрана из описи." confirmLabel="Удалить" onClose=${() => setRemoveId(null)} onConfirm=${async () => {
      try {
        await findingsApi.remove(removeId);
        setRemoveId(null);
        setStatus("Находка удалена", "ok");
        findings.reload();
      } catch (err) {
        setStatus(err.message, "error");
      }
    }} />` : null}
  </section>`;
}
