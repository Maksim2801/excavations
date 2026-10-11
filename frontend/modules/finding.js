import { html, useEffect, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { dictionariesApi, excavationsApi, findingsApi, layersApi, gnssApi, uuid } from "../services/api.js";
import { useSession } from "./session.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { METHOD_LABELS, allow, issueText } from "./labels.js";
import { Breadcrumbs, ErrorText, Field, SectionHeading, useDraft } from "./ui.js";

const BLANK = {
  excavation_id: "", layer_id: "", code: "", number: "", square: "", material: "", find_type: "",
  description: "", full_desc: "", gnss_point_id: "", north: "", east: "", elev: "", length_mm: "", width_mm: "", thickness_mm: "",
  quantity: 1, note: "", vessel_part: "", ornament: "", surface_color: "", fracture_color: "",
  fabric: "", temper: "", surface_treatment: "", depth_cm: "", pt: "", measurement_method: "none",
};

export function FindingPage({ id }) {
  const isNew = id === "new";
  const { user } = useSession();
  const { navigate } = useRouter();
  const workspace = useWorkspace();
  const { setStatus } = useStatus();
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const loaded = useQuery(() => (isNew ? Promise.resolve(null) : findingsApi.get(id)), [id]);
  const excavations = useQuery(() => excavationsApi.list(), []);
  const [draft, setDraft, clearDraft] = useDraft(`finding-draft:${user.id}:${id}`, { ...BLANK, _requestKey: uuid(), excavation_id: workspace.excavationId, layer_id: workspace.layerId });
  const source = isNew ? draft : (loaded.data || BLANK);
  const [excavationId, setExcavationId] = useState(source.excavation_id || "");
  useEffect(() => { if (source.excavation_id) setExcavationId(String(source.excavation_id)); }, [loaded.data]);
  const [autoNumber, setAutoNumber] = useState(isNew && !draft.code);
  const points = useQuery(() => excavationId ? gnssApi.list(excavationId) : Promise.resolve([]), [excavationId]);
  const layers = useQuery(() => (excavationId ? layersApi.list(excavationId) : Promise.resolve([])), [excavationId]);
  const dictionaries = useQuery(() => dictionariesApi.list(), []);

  useEffect(() => {
    if (!isNew && loaded.data) setStatus(loaded.data.issues?.length ? issueText(loaded.data.issues) : "Карточка без замечаний", loaded.data.issues?.length ? "warn" : "ok");
  }, [isNew, loaded.data]);

  const onChange = (event) => {
    if (!isNew) return;
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.target).entries());
    Object.keys(data).forEach((key) => { if (data[key] === "") delete data[key]; });
    if (!allow(user, 2) || data.measurement_method === "photo") {
      delete data.measurement_method;
      // A field archaeologist can edit text without overwriting accepted photo dimensions.
      if (!isNew && source.measurement_method === "photo") {
        delete data.length_mm; delete data.width_mm; delete data.thickness_mm;
      }
    }
    if (!isNew && source.measurement_method === "photo" && data.measurement_method !== "manual") { delete data.length_mm; delete data.width_mm; delete data.thickness_mm; }
    if (!isNew && !data.gnss_point_id) data.gnss_point_id = null;
    if (isNew && autoNumber) { delete data.code; delete data.number; }
    setError(null);
    try {
      const saved = isNew ? await findingsApi.create(data, draft._requestKey) : await findingsApi.update(id, data);
      if (isNew) clearDraft();
      setStatus("Находка сохранена", "ok");
      navigate(`/findings/${saved.id}`);
    } catch (err) {
      setError(err);
      setStatus(err.message, "error");
    } finally { setSaving(false); }
  };

  if (!isNew && loaded.loading) return html`<p>Загрузка…</p>`;
  if (loaded.error) return html`<${ErrorText} error=${loaded.error} />`;

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Опись", href: "/inventory" }, { label: isNew ? "Новая находка" : `${source.code}-${source.number}` }]} />
    <${SectionHeading}>${isNew ? "Новая находка" : "Карточка находки"}<//>
    <form className="stack card-frame" key=${isNew ? "new" : source.id} onSubmit=${save} onChange=${onChange}>
      ${isNew ? html`<label><input type="checkbox" checked=${autoNumber} onChange=${(e) => setAutoNumber(e.target.checked)} /> Автоматический код и номер при сохранении</label>` : null}
      <div className="filter-grid">
        <${Field} label="Раскоп"><select name="excavation_id" defaultValue=${source.excavation_id || ""} required onChange=${(event) => { setExcavationId(event.target.value); if (isNew) setDraft((current) => ({ ...current, excavation_id: event.target.value, layer_id: "", gnss_point_id: "" }));
          const form = event.target.form; form.elements.layer_id.value = ""; if (form.elements.gnss_point_id) form.elements.gnss_point_id.value = ""; }}>
          <option value="">Выберите</option>
          ${(excavations.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code} (${item.year})</option>`)}
        </select></${Field}>
        <${Field} label="Пласт"><select name="layer_id" defaultValue=${source.layer_id || ""}>
          <option value="">Без пласта</option>
          ${(layers.data || []).map((item) => html`<option key=${item.id} value=${item.id}>Пласт ${item.number}</option>`)}
        </select></${Field}>
        <${Field} label="Код"><input name="code" disabled=${isNew && autoNumber} required=${!autoNumber} defaultValue=${source.code || ""} /></${Field}>
        <${Field} label="Номер"><input name="number" type="number" min="1" disabled=${isNew && autoNumber} required=${!autoNumber} defaultValue=${source.number || ""} /></${Field}>
        <${Field} label="Квадрат"><input name="square" defaultValue=${source.square || ""} /></${Field}>
        <${Field} label="Материал"><select name="material" defaultValue=${source.material || ""}>
          <option value="">Не указан</option>
          ${(dictionaries.data?.materials || []).map((item) => html`<option key=${item.id} value=${item.name}>${item.name}</option>`)}
        </select></${Field}>
        <${Field} label="Тип находки"><input name="find_type" defaultValue=${source.find_type || ""} /></${Field}>
        <${Field} label="Количество"><input name="quantity" type="number" min="1" defaultValue=${source.quantity || 1} /></${Field}>
        <${Field} label="Координаты из GNSS"><select name="gnss_point_id" defaultValue=${source.gnss_point_id || ""} onChange=${(e) => {
          const point = (points.data || []).find((item) => String(item.id) === e.target.value);
          if (point) {
            for (const key of ["north", "east", "elev"]) e.target.form.elements[key].value = point[key];
            if (isNew) setDraft((current) => ({ ...current, gnss_point_id: point.id, north: point.north, east: point.east, elev: point.elev }));
          }
        }}><option value="">Ручной ввод</option>${(points.data || []).map((point) => html`<option key=${point.id} value=${point.id}>#${point.id} ${point.comment || point.point_type_label || point.point_type}</option>`)}</select></${Field}>
        <${Field} label="North"><input name="north" type="number" step="0.001" onInput=${(e) => { e.target.form.elements.gnss_point_id.value = ""; if (isNew) setDraft((d) => ({ ...d, gnss_point_id: "" })); }} defaultValue=${source.north ?? ""} /></${Field}>
        <${Field} label="East"><input name="east" type="number" step="0.001" onInput=${(e) => { e.target.form.elements.gnss_point_id.value = ""; if (isNew) setDraft((d) => ({ ...d, gnss_point_id: "" })); }} defaultValue=${source.east ?? ""} /></${Field}>
        <${Field} label="Elev"><input name="elev" type="number" step="0.001" onInput=${(e) => { e.target.form.elements.gnss_point_id.value = ""; if (isNew) setDraft((d) => ({ ...d, gnss_point_id: "" })); }} defaultValue=${source.elev ?? ""} /></${Field}>
        <${Field} label="Глубина, см"><input name="depth_cm" type="number" step="0.1" defaultValue=${source.depth_cm ?? ""} /></${Field}>
        <${Field} label="Длина, мм"><input name="length_mm" type="number" step="0.1" defaultValue=${source.length_mm ?? ""} /></${Field}>
        <${Field} label="Ширина, мм"><input name="width_mm" type="number" step="0.1" defaultValue=${source.width_mm ?? ""} /></${Field}>
        <${Field} label="Толщина, мм"><input name="thickness_mm" type="number" step="0.1" defaultValue=${source.thickness_mm ?? ""} /></${Field}>
        <${Field} label="Способ измерения"><select name="measurement_method" defaultValue=${source.measurement_method || "none"} disabled=${!allow(user, 2)}>
          ${Object.entries(METHOD_LABELS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}
        </select></${Field}>
        <${Field} label="Pt"><input name="pt" type="number" defaultValue=${source.pt ?? ""} /></${Field}>
      </div>
      <${Field} label="Краткое описание"><textarea name="description" defaultValue=${source.description || ""}></textarea></${Field}>
      <${Field} label="Развёрнутое описание"><textarea name="full_desc" defaultValue=${source.full_desc || ""}></textarea></${Field}>
      <div className="filter-grid">
        <${Field} label="Часть сосуда"><input name="vessel_part" defaultValue=${source.vessel_part || ""} /></${Field}>
        <${Field} label="Орнамент"><input name="ornament" defaultValue=${source.ornament || ""} /></${Field}>
        <${Field} label="Цвет поверхности"><input name="surface_color" defaultValue=${source.surface_color || ""} /></${Field}>
        <${Field} label="Цвет в изломе"><input name="fracture_color" defaultValue=${source.fracture_color || ""} /></${Field}>
        <${Field} label="Структура"><input name="fabric" defaultValue=${source.fabric || ""} /></${Field}>
        <${Field} label="Примесь"><input name="temper" defaultValue=${source.temper || ""} /></${Field}>
        <${Field} label="Обработка поверхности"><input name="surface_treatment" defaultValue=${source.surface_treatment || ""} /></${Field}>
      </div>
      <${Field} label="Примечание"><textarea name="note" defaultValue=${source.note || ""}></textarea></${Field}>
      ${!allow(user, 2) ? html`<p className="muted">Перевод измерения в ручное доступен камеральному сотруднику и руководителю.</p>` : null}
      ${isNew ? html`<p className="muted">Черновик формы хранится в этом браузере, пока запись не сохранена.</p>` : null}
      <${ErrorText} error=${error} />
      <div className="actions">
        <button className="btn btn-gold" type="submit" disabled=${saving}>${saving ? "Сохранение…" : "Сохранить"}</button>
        ${!isNew ? html`<button type="button" className="btn btn-line" onClick=${() => navigate(`/photo/${id}`)}>Фотоанализ</button>` : null}
      </div>
    </form>
  </section>`;
}
