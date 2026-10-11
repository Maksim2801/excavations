import { html, useEffect, useRef, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { excavationsApi, layersApi, planApi } from "../services/api.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { Breadcrumbs, ErrorText, Field, SectionHeading } from "./ui.js";

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState(null);
  const drag = useRef(null);
  const [sizeTick, setSizeTick] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(() => setSizeTick((n) => n + 1));
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);
  const excavations = useQuery(() => excavationsApi.list(), []);
  const chosen = filters.excavation_id || excavations.data?.[0]?.id || "";
  const layers = useQuery(() => (chosen ? layersApi.list(chosen) : Promise.resolve([])), [chosen]);
  const plan = useQuery(() => (chosen ? planApi.get({ ...filters, excavation_id: chosen }) : Promise.resolve(null)), [chosen, filters.layer_id, filters.view, filters.color_by]);
  const focus = search.get("finding");
  useEffect(() => { setPan({ x: 0, y: 0 }); setZoom(1); setHover(null); setCursor(null); }, [chosen, filters.view, filters.layer_id]);

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
    const ox = (width - spanX * scale) / 2 + pan.x;
    const oy = (height - spanY * scale) / 2 - pan.y;
    const px = (x) => ox + (x - bounds.min_x) * scale;
    const py = (y) => height - (oy + (y - bounds.min_y) * scale);
    canvas.__project = { px, py, bounds, scale, width, height, ox, oy };
    if (data.outline?.length) {
      ctx.beginPath();
      data.outline.forEach((point, index) => {
        const x = px(point.x);
        const y = py(point.y);
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "#e8decd";
      ctx.fill();
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
  }, [plan.data, zoom, focus, pan, sizeTick]);

  const onMove = (event) => {
    const canvas = canvasRef.current;
    const data = plan.data;
    const project = canvas?.__project;
    if (!canvas || !data || !project) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (drag.current && event.buttons) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
      setPan({ x: drag.current.pan.x + dx, y: drag.current.pan.y + dy });
      setHover(null); return;
    }
    const hit = (data.points || []).find((point) => Math.hypot(project.px(point.x) - x, project.py(point.y) - y) < 10);
    setHover(hit ? { ...hit, left: x, top: y } : null);
    const worldX = data.bounds.min_x + (x - project.ox) / project.scale;
    const worldY = data.bounds.min_y + ((project.height - y) - project.oy) / project.scale;
    setCursor(`${worldX.toFixed(3)}, ${worldY.toFixed(3)} м`);
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "План" }]} />
    <${SectionHeading}>План<//>
    <form className="filter-strip" onSubmit=${(event) => { event.preventDefault(); plan.reload(); }}>
      <div className="filter-bar">
        <${Field} label="Раскоп"><select value=${chosen} onChange=${(event) => { workspace.setExcavationId(event.target.value); setFilters((current) => ({ ...current, excavation_id: event.target.value, layer_id: "" })); }}>
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
    <${ErrorText} error=${plan.error} />
    <div className="canvas-wrap">
      <canvas ref=${canvasRef} className="plan-canvas" style=${{ touchAction: "none", cursor: "grab" }}
        onPointerDown=${(e) => { drag.current = { x: e.clientX, y: e.clientY, pan, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove=${onMove}
        onPointerUp=${(e) => {
          const moved = drag.current?.moved;
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (moved) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left, y = e.clientY - rect.top;
          const project = e.currentTarget.__project;
          const hit = project && (plan.data?.points || []).find((point) => Math.hypot(project.px(point.x) - x, project.py(point.y) - y) < 14);
          if (e.pointerType === "touch") setHover(hit ? { ...hit, left: x, top: y } : null);
          else if (hit) navigate(`/findings/${hit.id}`);
        }}
        onPointerCancel=${() => { drag.current = null; }}
        onPointerLeave=${() => { if (!drag.current) setHover(null); }}></canvas>
      <div className="map-zoom">
        <button type="button" aria-label="Сбросить вид плана" title="Сбросить вид" onClick=${() => { setPan({ x: 0, y: 0 }); setZoom(1); }}>↺</button>
        <button type="button" onClick=${() => setZoom((value) => Math.min(3, value + 0.25))}>+</button>
        <button type="button" onClick=${() => setZoom((value) => Math.max(0.6, value - 0.25))}>−</button>
      </div>
      ${hover ? html`<div className="popup" style=${{ left: `${hover.left + 12}px`, top: `${hover.top + 12}px` }}>
        <strong>${hover.code}-${hover.number}</strong>
        <p>${hover.material || "без материала"} · кв. ${hover.square || "—"} · пласт ${hover.layer_number ?? "—"}</p>
        <p>Размеры: ${hover.length_mm ?? "—"} × ${hover.width_mm ?? "—"} × ${hover.thickness_mm ?? "—"} мм</p>
        <button type="button" className="btn btn-text" onClick=${() => navigate(`/inventory?q=${hover.code}`)}>Перейти к описи</button>
      </div>` : null}
    </div>
    <p aria-live="off">Курсор (${filters.view === "ne" ? "East / North" : filters.view === "n_elev" ? "North / Elev" : "East / Elev"}): ${cursor || "наведите на план"}</p>
    <div className="legend">
      ${(plan.data?.legend || []).map((item) => html`<span key=${item.key}><i style=${{ background: item.color }}></i>${item.key}</span>`)}
    </div>
    <p className="muted">Квадраты — GNSS, круги — находки. Щелчок открывает карточку.</p>
  </section>`;
}
