import { html, useEffect, useRef, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { excavationsApi, layersApi, planApi } from "../services/api.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { Breadcrumbs, Field, SectionHeading } from "./ui.js";

export function PlanPage() {
  const { navigate, search } = useRouter();
  const workspace = useWorkspace();
  const canvasRef = useRef(null);
  const [filters, setFilters] = useState({
    excavation_id: workspace.excavationId,
    layer_id: workspace.layerId,
    view: "ne",
    color_by: "material",
  });
  const [hover, setHover] = useState(null);
  const [zoom, setZoom] = useState(1);
  const excavations = useQuery(() => excavationsApi.list(), []);
  const chosen = filters.excavation_id || excavations.data?.[0]?.id || "";
  const layers = useQuery(() => (chosen ? layersApi.list(chosen) : Promise.resolve([])), [chosen]);
  const plan = useQuery(() => (chosen ? planApi.get({ ...filters, excavation_id: chosen }) : Promise.resolve(null)), [chosen, filters.layer_id, filters.view, filters.color_by]);
  const focus = search.get("finding");

  useEffect(() => {
    const canvas = canvasRef.current;
    const data = plan.data;
    if (!canvas || !data) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(0, 0, width, height);
    const bounds = data.bounds;
    const spanX = bounds.max_x - bounds.min_x || 1;
    const spanY = bounds.max_y - bounds.min_y || 1;
    const scale = Math.min(width / spanX, height / spanY) * 0.86 * zoom;
    const ox = (width - spanX * scale) / 2;
    const oy = (height - spanY * scale) / 2;
    const px = (x) => ox + (x - bounds.min_x) * scale;
    const py = (y) => height - (oy + (y - bounds.min_y) * scale);
    canvas.__project = { px, py, bounds, scale, width, height };
    if (data.outline?.length) {
      ctx.beginPath();
      data.outline.forEach((point, index) => {
        const x = px(point.x);
        const y = py(point.y);
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = "#8A8A8A";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    (data.gnss_points || []).forEach((point) => {
      ctx.fillStyle = point.point_type === "corner" ? "#B5532B" : "#7A7A7A";
      ctx.fillRect(px(point.x) - 4, py(point.y) - 4, 8, 8);
    });
    (data.points || []).forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = point.color || "#111";
      ctx.arc(px(point.x), py(point.y), String(point.id) === String(focus) ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [plan.data, zoom, focus]);

  const onMove = (event) => {
    const canvas = canvasRef.current;
    const data = plan.data;
    const project = canvas?.__project;
    if (!canvas || !data || !project) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = (data.points || []).find((point) => Math.hypot(project.px(point.x) - x, project.py(point.y) - y) < 10);
    setHover(hit ? { ...hit, left: x, top: y } : null);
    const worldX = data.bounds.min_x + (x - (project.width - (data.bounds.max_x - data.bounds.min_x) * project.scale) / 2) / project.scale;
    const worldY = data.bounds.min_y + ((project.height - y) - (project.height - (data.bounds.max_y - data.bounds.min_y) * project.scale) / 2) / project.scale;
    canvas.dataset.cursor = `${worldX.toFixed(2)}, ${worldY.toFixed(2)}`;
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "План" }]} />
    <${SectionHeading}>План<//>
    <form className="filter-strip" onSubmit=${(event) => { event.preventDefault(); plan.reload(); }}>
      <div className="filter-bar">
        <${Field} label="Раскоп"><select value=${chosen} onChange=${(event) => { workspace.setExcavationId(event.target.value); setFilters((current) => ({ ...current, excavation_id: event.target.value })); }}>
          ${(excavations.data || []).map((item) => html`<option key=${item.id} value=${item.id}>${item.code} (${item.year})</option>`)}
        </select></${Field}>
        <${Field} label="Пласт"><select value=${filters.layer_id} onChange=${(event) => { workspace.setLayerId(event.target.value); setFilters((current) => ({ ...current, layer_id: event.target.value })); }}>
          <option value="">Все пласты</option>
          ${(layers.data || []).map((item) => html`<option key=${item.id} value=${item.id}>Пласт ${item.number}</option>`)}
        </select></${Field}>
        <${Field} label="Проекция"><select value=${filters.view} onChange=${(event) => setFilters((current) => ({ ...current, view: event.target.value }))}>
          <option value="ne">North / East</option>
          <option value="n_elev">North / Elev</option>
          <option value="e_elev">East / Elev</option>
        </select></${Field}>
        <${Field} label="Цвет"><select value=${filters.color_by} onChange=${(event) => setFilters((current) => ({ ...current, color_by: event.target.value }))}>
          <option value="material">По материалу</option>
          <option value="layer">По пласту</option>
        </select></${Field}>
        <button className="btn btn-gold" type="submit">Показать</button>
      </div>
    </form>
    <div className="canvas-wrap">
      <canvas ref=${canvasRef} className="plan-canvas" onMouseMove=${onMove} onMouseLeave=${() => setHover(null)} onClick=${() => { if (hover) navigate(`/findings/${hover.id}`); }}></canvas>
      <div className="map-zoom">
        <button type="button" onClick=${() => setZoom((value) => Math.min(3, value + 0.25))}>+</button>
        <button type="button" onClick=${() => setZoom((value) => Math.max(0.6, value - 0.25))}>−</button>
      </div>
      ${hover ? html`<div className="popup" style=${{ left: `${hover.left + 12}px`, top: `${hover.top + 12}px` }}>
        <strong>${hover.code}-${hover.number}</strong>
        <p>${hover.material || "без материала"} · кв. ${hover.square || "—"}</p>
        <button type="button" className="btn btn-text" onClick=${() => navigate(`/inventory?q=${hover.code}`)}>Перейти к описи</button>
      </div>` : null}
    </div>
    <div className="legend">
      ${(plan.data?.legend || []).map((item) => html`<span key=${item.key}><i style=${{ background: item.color }}></i>${item.key}</span>`)}
    </div>
    <p className="muted">Квадраты — GNSS, круги — находки. Щелчок открывает карточку.</p>
  </section>`;
}
