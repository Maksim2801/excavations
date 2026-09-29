import { api } from "./api.js";
import { allow, loadExcavations, navigate, setExcavation, setLayer, state } from "./context.js";
import { bindDraft, esc, field, formValues, num, options, setStatus } from "./ui.js";

export async function renderLayers(root) {
  const excavations = await loadExcavations();
  const selected = state.excavationId || (excavations[0] ? String(excavations[0].id) : "");
  const layers = selected ? await api(`/api/excavations/${selected}/layers`) : [];
  root.innerHTML = `
    <div class="layout">
      <section class="panel">
        <h2>Пласты</h2>
        <form id="layer-form" class="stack">
          ${field("Раскоп", `<select name="excavation_id">${options(excavations, selected, (item) => item.id, (item) => `${item.code} (${item.year})`)}</select>`)}
          ${field("Номер", `<input name="number" type="number" min="1" required>`)}
          ${field("Верхняя отметка", `<input name="top_elev" type="number" step="0.001" required>`)}
          ${field("Нижняя отметка", `<input name="bottom_elev" type="number" step="0.001" required>`)}
          ${field("Цвет", `<input name="color">`)}
          ${field("Описание", `<textarea name="description"></textarea>`)}
          ${field("Поверхность после зачистки", `<textarea name="surface_description"></textarea>`)}
          ${field("Включения", `<textarea name="inclusions"></textarea>`)}
          ${field("Интерпретация", `<textarea name="interpretation"></textarea>`)}
          <div class="actions"><button class="btn btn-primary" type="submit">Создать пласт</button><button id="retry-layer" class="btn btn-ghost" type="button" hidden>Повторить</button></div>
        </form>
      </section>
      <section class="stack" id="layer-list"></section>
    </div>`;
  document.getElementById("layer-list").innerHTML = layers.map((layer) => `
    <article class="card" data-id="${layer.id}">
      <h3>Пласт ${layer.number}</h3>
      <p>${esc(layer.description || "")} · ${esc(layer.color || "цвет не указан")}</p>
      <p>Elev ${layer.bottom_elev} - ${layer.top_elev}. Находки: ${layer.finding_count}, фото: ${layer.photo_count}</p>
      <p class="muted">${esc(layer.surface_description || "")}</p>
      <div class="actions">
        <button class="btn btn-primary" type="button" data-open="${layer.id}" data-excavation="${layer.excavation_id}">Находки пласта</button>
        ${allow(2) ? `<button class="btn btn-ghost" type="button" data-edit="${layer.id}">Править</button>` : ""}
        <form class="actions" data-photo="${layer.id}" data-excavation="${layer.excavation_id}">
          <input type="file" name="file" accept="image/*" required>
          <button class="btn btn-ghost" type="submit">Фото пласта</button>
        </form>
      </div>
      ${allow(2) ? `<form class="form-grid edit" data-save="${layer.id}" hidden>
        <input name="description" value="${esc(layer.description || "")}" placeholder="Описание">
        <input name="color" value="${esc(layer.color || "")}" placeholder="Цвет">
        <input name="top_elev" type="number" step="0.001" value="${layer.top_elev}">
        <input name="bottom_elev" type="number" step="0.001" value="${layer.bottom_elev}">
        <button class="btn btn-primary" type="submit">Сохранить</button>
      </form>` : ""}
    </article>`).join("") || `<p class="panel">Пластов пока нет.</p>`;

  const form = document.getElementById("layer-form");
  const draft = bindDraft(form, "draft-layer");
  form.elements.excavation_id.addEventListener("change", () => {
    setExcavation(form.elements.excavation_id.value);
    renderLayers(root);
  });
  const retry = document.getElementById("retry-layer");
  const submit = async () => {
    const raw = formValues(form);
    setStatus("Отправка пласта…");
    try {
      await api("/api/layers", {
        method: "POST",
        idempotencyKey: draft.idempotencyKey,
        body: {
          excavation_id: Number(raw.excavation_id),
          number: Number(raw.number),
          top_elev: num(raw.top_elev),
          bottom_elev: num(raw.bottom_elev),
          color: raw.color || null,
          description: raw.description || null,
          surface_description: raw.surface_description || null,
          inclusions: raw.inclusions || null,
          interpretation: raw.interpretation || null,
        },
      });
      draft.clear();
      setExcavation(raw.excavation_id);
      setStatus("Пласт создан", "ok");
      renderLayers(root);
    } catch (error) {
      retry.hidden = false;
      setStatus(error.message, "error");
    }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  retry.addEventListener("click", submit);
  root.querySelector("#layer-list").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit]");
    const open = event.target.closest("[data-open]");
    if (edit) edit.closest("article").querySelector(".edit").hidden = false;
    if (open) {
      setExcavation(open.dataset.excavation);
      setLayer(open.dataset.open);
      navigate("/inventory");
    }
  });
  root.querySelectorAll("[data-save]").forEach((editForm) => {
    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = formValues(editForm);
      try {
        await api(`/api/layers/${editForm.dataset.save}`, {
          method: "PUT",
          body: { description: raw.description, color: raw.color, top_elev: num(raw.top_elev), bottom_elev: num(raw.bottom_elev) },
        });
        setStatus("Пласт обновлён", "ok");
        renderLayers(root);
      } catch (error) { setStatus(error.message, "error"); }
    });
  });
  root.querySelectorAll("[data-photo]").forEach((photoForm) => {
    photoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData();
      data.append("file", photoForm.file.files[0]);
      data.append("layer_id", photoForm.dataset.photo);
      data.append("excavation_id", photoForm.dataset.excavation);
      data.append("photo_type", "layer");
      data.append("has_scale", "true");
      try {
        await api("/api/photos", { method: "POST", formData: data });
        setStatus("Фотография пласта загружена", "ok");
        renderLayers(root);
      } catch (error) { setStatus(error.message, "error"); }
    });
  });
}
