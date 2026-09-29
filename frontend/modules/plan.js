import { api } from "./api.js";
import { loadExcavations, navigate, setExcavation, setLayer, state } from "./context.js";
import { esc, field, fmt, options, setStatus } from "./ui.js";

export async function renderPlan(root) {
  const excavations = await loadExcavations();
  const excavationId = state.excavationId || (excavations[0] ? String(excavations[0].id) : "");
  const layers = excavationId ? await api(`/api/layers?excavation_id=${excavationId}`) : [];
  const focus = new URLSearchParams(location.hash.split("?")[1] || "").get("finding");
  root.innerHTML = `
    <section class="panel stack">
      <h2>План</h2>
      <form id="plan-filters" class="filters">
        ${field("Раскоп", `<select name="excavation_id">${options(excavations, excavationId, (item) => item.id, (item) => `${item.code} (${item.year})`)}</select>`)}
        ${field("Пласт", `<select name="layer_id">${options(layers, state.layerId, (item) => item.id, (item) => `Пласт ${item.number}`, "Все пласты")}</select>`)}
        ${field("Проекция", `<select name="view"><option value="ne">North / East</option><option value="n_elev">North / Elev</option><option value="e_elev">East / Elev</option></select>`)}
        ${field("Цвет", `<select name="color_by"><option value="material">По материалу</option><option value="layer">По пласту</option></select>`)}
        <button class="btn btn-primary" type="submit">Показать</button>
      </form>
      <div class="canvas-wrap"><canvas id="plan-canvas"></canvas><div id="plan-popup" class="popup" hidden></div></div>
      <div id="legend" class="legend"></div>
      <p class="muted" id="cursor"></p>
    </section>`;
  const canvas = document.getElementById("plan-canvas");
  const popup = document.getElementById("plan-popup");
  let plan = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
  };
  const project = (x, y) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const bounds = plan.bounds;
    const dx = Math.max(bounds.max_x - bounds.min_x, 0.001);
    const dy = Math.max(bounds.max_y - bounds.min_y, 0.001);
    const base = Math.min((width - 48) / dx, (height - 48) / dy);
    return [
      24 + panX + (x - bounds.min_x) * base * zoom,
      height - 24 + panY - (y - bounds.min_y) * base * zoom,
    ];
  };
  const draw = () => {
    resize();
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = "#efe6d4";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (plan.outline.length > 2) {
      ctx.beginPath();
      plan.outline.forEach((point, index) => {
        const [sx, sy] = project(point.x, point.y);
        if (index === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(122, 90, 58, 0.18)";
      ctx.strokeStyle = "#6b4e32";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
    for (const point of plan.gnss_points) {
      const [sx, sy] = project(point.x, point.y);
      ctx.fillStyle = point.point_type === "corner" ? "#2c2416" : "#8a8175";
      ctx.fillRect(sx - 4, sy - 4, 8, 8);
    }
    for (const point of plan.points) {
      const [sx, sy] = project(point.x, point.y);
      ctx.beginPath();
      ctx.fillStyle = point.color;
      ctx.arc(sx, sy, focus === String(point.id) ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.stroke();
    }
  };
  const load = async () => {
    const form = document.getElementById("plan-filters");
    const excavation = form.excavation_id.value;
    const layer = form.layer_id.value;
    setExcavation(excavation);
    setLayer(layer);
    const params = new URLSearchParams({ excavation_id: excavation, view: form.view.value, color_by: form.color_by.value });
    if (layer) params.set("layer_id", layer);
    plan = await api(`/api/plan?${params.toString()}`);
    zoom = 1; panX = 0; panY = 0;
    document.getElementById("legend").innerHTML = plan.legend.map((item) => `<span><i class="swatch" style="background:${esc(item.color)}"></i>${esc(item.key)}</span>`).join("");
    draw();
    setStatus(`Точек находок: ${plan.points.length}, GNSS: ${plan.gnss_points.length}`, "ok");
    if (focus) show(plan.points.find((item) => String(item.id) === focus));
  };
  const show = (point) => {
    if (!point) { popup.hidden = true; return; }
    popup.hidden = false;
    popup.innerHTML = `
      <strong>${esc(point.code)}</strong>
      <p>Пласт ${point.layer_number ?? "-"} · ${esc(point.material || "без материала")}</p>
      <p>N ${fmt(point.north)} · E ${fmt(point.east)} · Z ${fmt(point.elev)}</p>
      <p>Д ${fmt(point.length_mm, 1)} · Ш ${fmt(point.width_mm, 1)} · Т ${fmt(point.thickness_mm, 1)}</p>
      <button class="btn btn-primary" id="open-finding" type="button">Перейти к описи</button>`;
    document.getElementById("open-finding").onclick = () => navigate(`/finding/${point.id}`);
  };
  canvas.addEventListener("mousemove", (event) => {
    if (!plan) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (drag) { panX += x - drag.x; panY += y - drag.y; drag = { x, y }; draw(); return; }
    const hit = plan.points.find((point) => {
      const [sx, sy] = project(point.x, point.y);
      return Math.hypot(sx - x, sy - y) < 12;
    });
    document.getElementById("cursor").textContent = hit ? `${hit.code}: N ${fmt(hit.north)}, E ${fmt(hit.east)}, Z ${fmt(hit.elev)}` : "Колесо - масштаб, перетаскивание - сдвиг";
  });
  canvas.addEventListener("mousedown", (event) => {
    const rect = canvas.getBoundingClientRect();
    drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  window.addEventListener("mouseup", () => { drag = null; });
  canvas.addEventListener("click", (event) => {
    if (!plan) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = plan.points.find((point) => {
      const [sx, sy] = project(point.x, point.y);
      return Math.hypot(sx - x, sy - y) < 12;
    });
    show(hit);
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom *= event.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.min(12, Math.max(0.4, zoom));
    draw();
  }, { passive: false });
  document.getElementById("plan-filters").addEventListener("submit", (event) => {
    event.preventDefault();
    load().catch((error) => setStatus(error.message, "error"));
  });
  document.getElementById("plan-filters").excavation_id.addEventListener("change", async (event) => {
    setExcavation(event.target.value);
    const next = await api(`/api/layers?excavation_id=${event.target.value}`);
    document.getElementById("plan-filters").layer_id.innerHTML = options(next, "", (item) => item.id, (item) => `Пласт ${item.number}`, "Все пласты");
  });
  if (excavationId) await load();
}
