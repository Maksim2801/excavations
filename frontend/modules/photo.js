import { api } from "./api.js";
import { state } from "./context.js";
import { esc, field, options, setStatus } from "./ui.js";

export async function renderPhoto(root, findingId) {
  const params = new URLSearchParams({ page_size: "200" });
  if (state.excavationId) params.set("excavation_id", state.excavationId);
  const findings = await api(`/api/findings?${params.toString()}`);
  const selectedId = findingId || findings.items[0]?.id || "";
  root.innerHTML = `
    <section class="panel stack">
      <h2>Фотоанализ</h2>
      <div class="filters">
        ${field("Находка", `<select id="finding-id">${options(findings.items, selectedId, (item) => item.id, (item) => `${item.code}-${item.number}`)}</select>`)}
        ${field("Масштаб, мм", `<input id="scale-mm" type="number" min="0.1" step="0.1" value="100">`)}
      </div>
      <div id="photo-tools" class="actions"></div>
      <p id="photo-hint" class="muted">Щёлкните две точки на снимке. Перетаскивание сдвигает изображение, колесо меняет масштаб просмотра.</p>
      <div class="photo-layout">
        <div class="canvas-wrap"><canvas id="measure-canvas"></canvas></div>
        <aside class="stack">
          <div id="result" class="card"><h3>Результат</h3><p class="muted">Выберите фотографию, укажите масштаб и линии.</p></div>
          <p class="muted">Жёлтая линия - масштаб, красная - длина, синяя - ширина, зелёная - толщина. Точки можно перетаскивать. Колесо меняет масштаб просмотра.</p>
        </aside>
      </div>
    </section>`;
  const canvas = document.getElementById("measure-canvas");
  const tools = document.getElementById("photo-tools");
  let photos = [];
  let photo = null;
  let image = null;
  let zoom = 1;
  let panX = 20;
  let panY = 20;
  let mode = "scale";
  let drag = null;
  const lines = { scale: [], length: [], width: [], thickness: [] };
  const colors = { scale: "#c2881b", length: "#8c3a2f", width: "#2f5f8a", thickness: "#2f6b4f" };
  const modeLabels = { scale: "масштаб", length: "длину", width: "ширину", thickness: "толщину" };
  canvas.style.cursor = "crosshair";
  const refreshMode = () => {
    tools.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("btn-primary", active);
      button.classList.toggle("btn-ghost", !active);
    });
    const hint = document.getElementById("photo-hint");
    if (!hint) return;
    const count = lines[mode].length;
    const next = count === 0 ? "две точки" : count === 1 ? "вторую точку" : "две новые точки, чтобы заменить линию";
    hint.textContent = `Сейчас отмечается ${modeLabels[mode]}. Щёлкните на снимке ${next}. Перетаскивание сдвигает изображение.`;
  };

  const toScreen = (point) => [point.x * zoom + panX, point.y * zoom + panY];
  const toImage = (x, y) => ({ x: (x - panX) / zoom, y: (y - panY) / zoom });
  const draw = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = "#1c1915";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (!image) return;
    ctx.drawImage(image, panX, panY, image.width * zoom, image.height * zoom);
    for (const [name, points] of Object.entries(lines)) {
      if (!points.length) continue;
      ctx.strokeStyle = colors[name];
      ctx.fillStyle = colors[name];
      ctx.lineWidth = name === mode ? 3 : 2;
      if (points.length === 2) {
        const [a, b] = points.map(toScreen);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (const point of points) {
        const [sx, sy] = toScreen(point);
        ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  const showResult = (data) => {
    document.getElementById("result").innerHTML = `
      <h3>Результат</h3>
      <p><strong>Способ:</strong> по фото</p>
      <p><strong>Фото:</strong> ${esc(photo?.original_name || "")}</p>
      <p><strong>Масштаб:</strong> ${data.scale_mm ?? "-"} мм / ${data.scale_pixel_distance ?? "-"} px</p>
      <p><strong>Длина:</strong> ${data.length_mm ?? (data.measurement_type === "length" ? data.result_mm : "-")} мм</p>
      <p><strong>Ширина:</strong> ${data.width_mm ?? (data.measurement_type === "width" ? data.result_mm : "-")} мм</p>
      <p><strong>Толщина:</strong> ${data.thickness_mm ?? (data.measurement_type === "thickness" ? data.result_mm : "-")} мм</p>
      <p><strong>Источник:</strong> ${esc(data.result_source || data.source || "")}</p>
      <p><strong>Маркер:</strong> ${esc(data.detection_status || data.status || "")}</p>
      <p><strong>Предмет:</strong> ${esc(data.object_status || "")}</p>
      <p>${esc(data.message || "")}</p>`;
  };
  const loadPhotos = async (id) => {
    const finding = await api(`/api/findings/${id}`);
    photos = finding.photos || [];
    tools.innerHTML = photos.map((item) => `<button class="btn btn-ghost" type="button" data-photo="${item.id}">${esc(item.original_name)}</button>`).join("")
      + `<button class="btn btn-ghost" data-mode="scale" type="button">Масштаб</button>
         <button class="btn btn-ghost" data-mode="length" type="button">Длина</button>
         <button class="btn btn-ghost" data-mode="width" type="button">Ширина</button>
         <button class="btn btn-ghost" data-mode="thickness" type="button">Толщина</button>
         <button class="btn btn-primary" id="detect" type="button">Распознать маркер</button>
         <button class="btn btn-primary" id="analyze" type="button">Разобрать снимок</button>
         <button class="btn btn-primary" id="calc" type="button">Рассчитать</button>
         <button class="btn btn-primary" id="accept" type="button">Принять</button>`;
    tools.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { mode = button.dataset.mode; refreshMode(); }));
    refreshMode();
    tools.querySelectorAll("[data-photo]").forEach((button) => button.addEventListener("click", () => openPhoto(photos.find((item) => String(item.id) === button.dataset.photo))));
    document.getElementById("detect").onclick = detect;
    document.getElementById("analyze").onclick = () => analyze(true);
    document.getElementById("calc").onclick = () => measure(false);
    document.getElementById("accept").onclick = () => measure(true);
    const requested = new URLSearchParams(location.hash.split("?")[1] || "").get("photo");
    if (photos.length) await openPhoto(photos.find((item) => String(item.id) === requested) || photos[0]);
    else { photo = null; image = null; draw(); }
  };
  let generation = 0;
  const openPhoto = async (item) => {
    const ticket = ++generation;
    photo = item;
    lines.scale = [];
    lines.length = [];
    lines.width = [];
    lines.thickness = [];
    const response = await api(`/api/photos/${item.id}/file`, { raw: true });
    const blob = await response.blob();
    image = new Image();
    image.src = URL.createObjectURL(blob);
    await image.decode();
    if (ticket !== generation) return;
    zoom = Math.min((canvas.clientWidth - 40) / image.width, (canvas.clientHeight - 40) / image.height, 1);
    panX = 20; panY = 20;
    draw();
    await analyze(false, ticket);
  };
  const analyze = async (manual, ticket = generation) => {
    if (!photo) return;
    const scaleMm = Number(document.getElementById("scale-mm").value);
    if (manual) setStatus("Разбор снимка…");
    try {
      const proposal = await api(`/api/photos/${photo.id}/analyze?scale_mm=${encodeURIComponent(scaleMm)}`, { method: "POST" });
      if (ticket !== generation) return;
      if (proposal.scale_points?.length === 2) lines.scale = proposal.scale_points;
      if (proposal.length_points?.length === 2) lines.length = proposal.length_points;
      if (proposal.width_points?.length === 2) lines.width = proposal.width_points;
      showResult({
        ...proposal,
        detection_status: proposal.status,
        result_source: proposal.object_status === "detected" ? "auto_marker" : proposal.source,
      });
      refreshMode();
      draw();
      setStatus(proposal.message, proposal.status === "detected" && proposal.object_status === "detected" ? "ok" : "warn");
    } catch (error) {
      if (ticket === generation) setStatus(error.message, "error");
    }
  };
  const detect = async () => {
    if (!photo) return;
    setStatus("Распознавание маркера…");
    try {
      const detected = await api(`/api/photos/${photo.id}/detect-scale`, { method: "POST" });
      if (detected.points?.length === 2) lines.scale = detected.points;
      showResult({ message: detected.message, detection_status: detected.status, points: { scale_points: detected.points }, result_source: detected.source });
      draw();
      setStatus(detected.message, detected.status === "detected" ? "ok" : "warn");
    } catch (error) { setStatus(error.message, "error"); }
  };
  const measure = async (accept) => {
    if (!photo) return;
    const scaleMm = Number(document.getElementById("scale-mm").value);
    const targets = ["length", "width", "thickness"].filter((name) => lines[name].length === 2);
    if (!targets.length) { setStatus("Укажите линию длины, ширины или толщины", "warn"); return; }
    setStatus(accept ? "Сохранение измерения…" : "Расчёт…");
    try {
      for (const measurementType of targets) {
        const result = await api(`/api/findings/${document.getElementById("finding-id").value}/measure`, {
          method: "POST",
          body: {
            photo_id: photo.id,
            measurement_type: measurementType,
            scale_mm: scaleMm,
            scale_points: lines.scale.length === 2 ? lines.scale : null,
            object_points: lines[measurementType],
            accept,
          },
        });
        if (result.points?.scale_points?.length === 2 && lines.scale.length !== 2) lines.scale = result.points.scale_points;
        showResult(result);
        if (accept && !result.accepted) {
          setStatus(result.message || "Измерение не принято", "warn");
          draw();
          return;
        }
      }
      draw();
      setStatus(accept ? "Измерение записано в карточку" : "Результат получен, проверьте линии", "ok");
    } catch (error) { setStatus(error.message, "error"); }
  };
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const imagePoint = toImage(x, y);
    zoom = Math.min(8, Math.max(0.2, zoom * factor));
    panX = x - imagePoint.x * zoom;
    panY = y - imagePoint.y * zoom;
    draw();
  }, { passive: false });
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    canvas.setPointerCapture(event.pointerId);
    for (const points of Object.values(lines)) {
      const index = points.findIndex((point) => Math.hypot(toScreen(point)[0] - x, toScreen(point)[1] - y) < 12);
      if (index >= 0) { drag = { points, index, moved: false, x, y }; return; }
    }
    drag = { pan: true, x, y, panX, panY, moved: false };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (Math.hypot(x - drag.x, y - drag.y) > 4) drag.moved = true;
    if (!drag.moved) return;
    if (drag.pan) { panX = drag.panX + x - drag.x; panY = drag.panY + y - drag.y; }
    else drag.points[drag.index] = toImage(x, y);
    draw();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!drag) return;
    const moved = drag.moved;
    const panning = drag.pan;
    drag = null;
    if (moved || !panning || !image) return;
    const rect = canvas.getBoundingClientRect();
    const point = toImage(event.clientX - rect.left, event.clientY - rect.top);
    const current = lines[mode];
    if (current.length >= 2) lines[mode] = [point];
    else current.push(point);
    refreshMode();
    draw();
  });
  document.getElementById("finding-id").addEventListener("change", (event) => loadPhotos(event.target.value));
  if (selectedId) await loadPhotos(selectedId);
}
