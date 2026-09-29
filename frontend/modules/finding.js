import { api } from "./api.js";
import { allow, loadExcavations, navigate, setExcavation, setLayer, state } from "./context.js";
import { bindDraft, esc, field, formValues, num, options, setStatus, uuid } from "./ui.js";

export async function renderFinding(root, id) {
  const excavations = await loadExcavations();
  const dictionaries = await api("/api/dictionaries");
  const isNew = id === "new";
  const finding = isNew ? null : await api(`/api/findings/${id}`);
  const excavationId = finding?.excavation_id || state.excavationId || excavations[0]?.id || "";
  const layers = excavationId ? await api(`/api/layers?excavation_id=${excavationId}`) : [];
  const materials = dictionaries.materials.filter((item) => item.is_active);
  const lockedDimensions = finding?.measurement_method === "photo" && !allow(2);
  root.innerHTML = `
    <section class="panel stack">
      <div class="actions">
        <h2>${isNew ? "Новая находка" : `Находка ${esc(finding.code)}-${finding.number}`}</h2>
        ${finding ? `<button class="btn btn-ghost" id="go-photo" type="button">Фотоанализ</button><button class="btn btn-ghost" id="go-plan" type="button">На плане</button>` : ""}
      </div>
      <form id="finding-form" class="stack">
        <h3>Идентификация</h3>
        <div class="form-grid">
          ${field("Код", `<input name="code" required value="${esc(finding?.code || "")}">`)}
          ${field("Номер", `<input name="number" type="number" min="1" required value="${finding?.number || ""}">`)}
          ${field("Раскоп", `<select name="excavation_id">${options(excavations, excavationId, (item) => item.id, (item) => `${item.code} (${item.year})`)}</select>`)}
          ${field("Пласт", `<select name="layer_id">${options(layers, finding?.layer_id || state.layerId, (item) => item.id, (item) => `Пласт ${item.number}`, "Не выбран")}</select>`)}
        </div>
        <h3>Локализация</h3>
        <div class="form-grid">
          ${field("Квадрат", `<input name="square" value="${esc(finding?.square || "")}">`)}
          ${field("North", `<input name="north" type="number" step="0.001" value="${finding?.north ?? ""}">`)}
          ${field("East", `<input name="east" type="number" step="0.001" value="${finding?.east ?? ""}">`)}
          ${field("Elev", `<input name="elev" type="number" step="0.001" value="${finding?.elev ?? ""}">`)}
          ${field("Глубина, см", `<input name="depth_cm" type="number" step="0.1" value="${finding?.depth_cm ?? ""}">`)}
        </div>
        <h3>Описание</h3>
        <div class="form-grid">
          ${field("Материал", `<select name="material">${options(materials, finding?.material || "", (item) => item.name, (item) => item.name, "Не выбран")}</select>`)}
          ${field("Тип находки", `<input name="find_type" value="${esc(finding?.find_type || "")}">`)}
          ${field("Количество", `<input name="quantity" type="number" min="1" value="${finding?.quantity || 1}">`)}
          ${field("Часть сосуда", `<input name="vessel_part" value="${esc(finding?.vessel_part || "")}">`)}
          ${field("Орнамент", `<input name="ornament" value="${esc(finding?.ornament || "")}">`)}
          ${field("Цвет поверхности", `<input name="surface_color" value="${esc(finding?.surface_color || "")}">`)}
        </div>
        ${field("Описание", `<textarea name="description">${esc(finding?.description || "")}</textarea>`)}
        ${field("Примечание", `<textarea name="note">${esc(finding?.note || "")}</textarea>`)}
        <h3>Размеры, мм</h3>
        <div class="form-grid">
          ${field("Длина", `<input name="length_mm" type="number" step="0.1" ${lockedDimensions ? "readonly" : ""} value="${finding?.length_mm ?? ""}">`)}
          ${field("Ширина", `<input name="width_mm" type="number" step="0.1" ${lockedDimensions ? "readonly" : ""} value="${finding?.width_mm ?? ""}">`)}
          ${field("Толщина", `<input name="thickness_mm" type="number" step="0.1" ${lockedDimensions ? "readonly" : ""} value="${finding?.thickness_mm ?? ""}">`)}
        </div>
        <p class="muted">Способ измерения: ${finding ? (finding.measurement_method === "photo" ? "по фото" : finding.measurement_method === "manual" ? "ручное" : "не указан") : "будет определён при сохранении"}.</p>
        <div class="actions">
          <button class="btn btn-primary" type="submit">Сохранить</button>
          <button class="btn btn-ghost" id="retry-finding" type="button" hidden>Повторить</button>
          ${finding && allow(2) && finding.measurement_method === "photo" ? `<button class="btn btn-ghost" id="make-manual" type="button">Считать измерение ручным</button>` : ""}
          ${finding && !lockedDimensions ? `<button class="btn btn-ghost" id="save-dimensions" type="button">Сохранить размеры как ручные</button>` : ""}
        </div>
      </form>
      ${finding ? `<section><h3>Фотографии</h3><div class="thumbs" id="thumbs"></div>
        <form id="photo-form" class="actions"><input type="file" name="file" accept="image/*" required><label><input type="checkbox" name="has_scale" checked> есть масштаб</label><button class="btn btn-primary" type="submit">Загрузить</button></form>
        <h3>История измерений</h3><div class="table-wrap"><table><thead><tr><th>Тип</th><th>Способ</th><th>Источник</th><th>Статус маркера</th><th>Масштаб, мм</th><th>Результат, мм</th><th>Принято</th></tr></thead><tbody id="measures"></tbody></table></div></section>` : `<p class="muted">После сохранения можно загрузить фотографию и выполнить измерение. Повторная отправка не создаст дубликат.</p>`}
    </section>`;

  const form = document.getElementById("finding-form");
  const draft = isNew ? bindDraft(form, "draft-finding") : { idempotencyKey: uuid(), clear() {} };
  form.elements.excavation_id.addEventListener("change", async () => {
    setExcavation(form.elements.excavation_id.value);
    const nextLayers = await api(`/api/layers?excavation_id=${form.elements.excavation_id.value}`);
    form.elements.layer_id.innerHTML = options(nextLayers, "", (item) => item.id, (item) => `Пласт ${item.number}`, "Не выбран");
  });
  const payloadFromForm = () => {
    const raw = formValues(form);
    return {
      excavation_id: Number(raw.excavation_id),
      layer_id: raw.layer_id ? Number(raw.layer_id) : null,
      code: raw.code.trim(),
      number: Number(raw.number),
      square: raw.square || null,
      north: num(raw.north),
      east: num(raw.east),
      elev: num(raw.elev),
      depth_cm: num(raw.depth_cm),
      material: raw.material || null,
      find_type: raw.find_type || null,
      quantity: Number(raw.quantity || 1),
      vessel_part: raw.vessel_part || null,
      ornament: raw.ornament || null,
      surface_color: raw.surface_color || null,
      description: raw.description || null,
      note: raw.note || null,
      length_mm: num(raw.length_mm),
      width_mm: num(raw.width_mm),
      thickness_mm: num(raw.thickness_mm),
    };
  };
  const retry = document.getElementById("retry-finding");
  const save = async () => {
    const body = payloadFromForm();
    setStatus("Отправка находки…");
    try {
      if (isNew) {
        const created = await api("/api/findings", { method: "POST", body, idempotencyKey: draft.idempotencyKey });
        draft.clear();
        setExcavation(body.excavation_id);
        setLayer(body.layer_id || "");
        setStatus("Находка сохранена", "ok");
        navigate(`/finding/${created.id}`);
      } else {
        const update = { ...body };
        if (lockedDimensions) {
          delete update.length_mm; delete update.width_mm; delete update.thickness_mm;
        }
        await api(`/api/findings/${id}`, { method: "PUT", body: update });
        setStatus("Карточка обновлена", "ok");
        renderFinding(root, id);
      }
    } catch (error) {
      retry.hidden = false;
      setStatus(error.message, "error");
    }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); save(); });
  retry.addEventListener("click", save);
  document.getElementById("save-dimensions")?.addEventListener("click", async () => {
    const body = payloadFromForm();
    try {
      await api(`/api/findings/${id}/dimensions`, {
        method: "PUT",
        body: { length_mm: body.length_mm, width_mm: body.width_mm, thickness_mm: body.thickness_mm, measurement_method: "manual" },
      });
      setStatus("Размеры записаны как ручные", "ok");
      renderFinding(root, id);
    } catch (error) { setStatus(error.message, "error"); }
  });
  document.getElementById("make-manual")?.addEventListener("click", async () => {
    const body = payloadFromForm();
    try {
      await api(`/api/findings/${id}/dimensions`, {
        method: "PUT",
        body: { length_mm: body.length_mm, width_mm: body.width_mm, thickness_mm: body.thickness_mm, measurement_method: "manual" },
      });
      setStatus("Измерение переведено в ручной режим", "ok");
      renderFinding(root, id);
    } catch (error) { setStatus(error.message, "error"); }
  });
  document.getElementById("go-photo")?.addEventListener("click", () => navigate(`/photo/${id}`));
  document.getElementById("go-plan")?.addEventListener("click", () => {
    setExcavation(finding.excavation_id);
    if (finding.layer_id) setLayer(finding.layer_id);
    navigate(`/plan?finding=${id}`);
  });
  if (!finding) return;
  const photos = finding.photos || [];
  const thumbs = document.getElementById("thumbs");
  thumbs.innerHTML = photos.map((photo) => `<button type="button" data-photo="${photo.id}"><img alt="${esc(photo.original_name)}" src=""></button>`).join("") || "<p>Фотографий нет</p>";
  for (const photo of photos) {
    const image = thumbs.querySelector(`[data-photo="${photo.id}"] img`);
    api(`/api/photos/${photo.id}/thumb`, { raw: true }).then((response) => response.blob()).then((blob) => { image.src = URL.createObjectURL(blob); }).catch(() => {});
    thumbs.querySelector(`[data-photo="${photo.id}"]`).addEventListener("click", () => navigate(`/photo/${finding.id}?photo=${photo.id}`));
  }
  document.getElementById("measures").innerHTML = (finding.measurements || []).map((item) => `
    <tr><td>${esc(item.measurement_type)}</td><td>${item.method === "photo" ? "по фото" : "ручное"}</td><td>${esc(item.result_source)}</td><td>${esc(item.detection_status || "")}</td><td>${item.scale_mm ?? "-"}</td><td>${item.result_mm}</td><td>${item.accepted ? "да" : "нет"}</td></tr>
  `).join("") || `<tr><td colspan="7">Измерений нет</td></tr>`;
  document.getElementById("photo-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData();
    data.append("file", event.target.file.files[0]);
    data.append("finding_id", String(finding.id));
    data.append("photo_type", "finding");
    data.append("has_scale", event.target.has_scale.checked ? "true" : "false");
    setStatus("Загрузка фотографии…");
    try {
      await api("/api/photos", { method: "POST", formData: data });
      setStatus("Фотография загружена", "ok");
      renderFinding(root, id);
    } catch (error) { setStatus(error.message, "error"); }
  });
}
