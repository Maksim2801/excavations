import { html, useMemo, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { dictionariesApi, excavationsApi, findingsApi, layersApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { METHOD_LABELS, allow, fmt, issueText } from "./labels.js";
import { Breadcrumbs, ConfirmDialog, ErrorText, Field, Pagination, SectionHeading } from "./ui.js";

const SORTS = [["code", "Код"], ["number", "Номер"], ["north", "North"], ["east", "East"], ["elev", "Elev"], ["length_mm", "Длина"], ["width_mm", "Ширина"], ["thickness_mm", "Толщина"]];

export function InventoryPage() {
  const { user } = useSession();
  const { navigate, search } = useRouter();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("code");
  const [order, setOrder] = useState("asc");
  const [removeId, setRemoveId] = useState(null);
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
  }));
  const excavations = useQuery(() => excavationsApi.list(), []);
  const layers = useQuery(() => (filters.excavation_id ? layersApi.list(filters.excavation_id) : Promise.resolve([])), [filters.excavation_id]);
  const dictionaries = useQuery(() => dictionariesApi.list(), []);
  const params = useMemo(() => ({ ...filters, page, page_size: 12, sort, order }), [filters, page, sort, order]);
  const findings = useQuery(() => findingsApi.list(params), [JSON.stringify(params)]);
  const pages = Math.max(1, Math.ceil((findings.data?.total || 0) / 12));

  const setFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
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
      ${allow(user, 2) ? html`<button type="button" className="btn btn-line" onClick=${() => navigate("/reports")}>Экспорт</button>` : null}
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
        <button type="button" className="reset-link" onClick=${() => setFilters({ excavation_id: "", layer_id: "", q: "", code: "", material: "", square: "", measurement_method: "", photo_present: "", number_from: "", number_to: "", elev_from: "", elev_to: "" })}>Сбросить</button>
      </div>
    </form>
    <${ErrorText} error=${findings.error} />
    <div className="table-wrap"><table>
      <thead><tr>
        ${SORTS.map(([key, label]) => html`<th key=${key}><button type="button" className="sort" onClick=${() => toggleSort(key)}>${label}${sort === key ? (order === "asc" ? " ↑" : " ↓") : ""}</button></th>`)}
        <th>Раскоп</th><th>Пласт</th><th>Способ</th><th>Фото</th><th>Замечания</th><th></th>
      </tr></thead>
      <tbody>
        ${(findings.data?.items || []).map((item) => html`<tr key=${item.id} className=${item.issues?.length ? "problem" : ""}>
          <td>${item.code}</td><td>${item.number}</td>
          <td>${fmt(item.north)}</td><td>${fmt(item.east)}</td><td>${fmt(item.elev)}</td>
          <td>${fmt(item.length_mm, 1)}</td><td>${fmt(item.width_mm, 1)}</td><td>${fmt(item.thickness_mm, 1)}</td>
          <td>${item.excavation_code || ""}</td><td>${item.layer_number ?? "—"}</td>
          <td>${METHOD_LABELS[item.measurement_method] || item.measurement_method}</td>
          <td>${item.photo_present ? "да" : "нет"}</td>
          <td>${item.issues?.length ? issueText(item.issues) : ""}</td>
          <td className="actions">
            <button type="button" className="btn btn-text" onClick=${() => navigate(`/findings/${item.id}`)}>Карточка</button>
            <button type="button" className="btn btn-text" onClick=${() => navigate(`/photo/${item.id}`)}>Фото</button>
            <button type="button" className="btn btn-text" onClick=${() => { workspace.setExcavationId(item.excavation_id); if (item.layer_id) workspace.setLayerId(item.layer_id); navigate(`/plan?finding=${item.id}`); }}>План</button>
            ${allow(user, 2) ? html`<button type="button" className="btn btn-text danger" onClick=${() => setRemoveId(item.id)}>Удалить</button>` : null}
          </td>
        </tr>`)}
        ${!(findings.data?.items || []).length && !findings.loading ? html`<tr><td colspan="14">Записей нет</td></tr>` : null}
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
