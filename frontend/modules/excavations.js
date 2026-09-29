import { api } from "./api.js";
import { allow, invalidateExcavations, loadExcavations, navigate, setExcavation, state } from "./context.js";
import { bindDraft, esc, field, formValues, num, setStatus } from "./ui.js";

export async function renderExcavations(root) {
  const items = await loadExcavations(true);
  root.innerHTML = `
    <div class="layout">
      <section class="panel">
        <h2>Раскопы</h2>
        <p class="muted">Рабочий раскоп задаёт контекст описи, плана и GNSS.</p>
        ${allow(3) ? `<form id="excavation-form" class="stack">
          ${field("Код", `<input name="code" required>`)}
          ${field("Год", `<input name="year" type="number" required value="2026">`)}
          ${field("Центр North", `<input name="center_north" type="number" step="0.001" required>`)}
          ${field("Центр East", `<input name="center_east" type="number" step="0.001" required>`)}
          ${field("Центр Elev", `<input name="center_elev" type="number" step="0.001" required>`)}
          ${field("Площадь, м²", `<input name="area_m2" type="number" step="0.1">`)}
          ${field("Шаг сетки, м", `<input name="grid_step_m" type="number" step="0.1" value="5">`)}
          ${field("Описание", `<textarea name="description"></textarea>`)}
          ${field("Границы", `<textarea name="boundaries"></textarea>`)}
          <div class="actions"><button class="btn btn-primary" type="submit">Создать раскоп</button><button class="btn btn-ghost" id="retry-excavation" type="button" hidden>Повторить</button></div>
        </form>` : `<p>Создавать раскопы может руководитель работ.</p>`}
      </section>
      <section class="cards" id="excavation-cards"></section>
    </div>`;
  const cards = document.getElementById("excavation-cards");
  cards.innerHTML = items.map((item) => `
    <article class="card">
      <h3>${esc(item.code)} · ${item.year}</h3>
      <p>${item.status === "archived" ? '<span class="badge warn">архив</span>' : '<span class="badge">активный</span>'}</p>
      <p>Центр: N ${item.center_north}, E ${item.center_east}, Z ${item.center_elev}</p>
      <p class="muted">${esc(item.description || "")}</p>
      <p>Пласты: ${item.layer_count}, находки: ${item.finding_count}, GNSS: ${item.gnss_count}</p>
      <div class="actions">
        <button class="btn btn-primary" type="button" data-use="${item.id}">Сделать рабочим</button>
        <button class="btn btn-ghost" type="button" data-checks="${item.id}">Проверить</button>
        ${allow(3) && item.status === "active" ? `<button class="btn btn-ghost" type="button" data-archive="${item.id}">В архив</button>` : ""}
        ${allow(3) && item.status === "archived" ? `<button class="btn btn-ghost" type="button" data-restore="${item.id}">Вернуть</button>` : ""}
      </div>
      <div id="checks-${item.id}"></div>
    </article>`).join("") || `<p>Раскопов пока нет.</p>`;

  cards.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    try {
      if (button.dataset.use) {
        setExcavation(button.dataset.use);
        setStatus("Рабочий раскоп выбран", "ok");
        navigate("/layers");
      } else if (button.dataset.archive) {
        await api(`/api/excavations/${button.dataset.archive}/archive`, { method: "POST" });
        invalidateExcavations();
        renderExcavations(root);
      } else if (button.dataset.restore) {
        await api(`/api/excavations/${button.dataset.restore}/restore`, { method: "POST" });
        invalidateExcavations();
        renderExcavations(root);
      } else if (button.dataset.checks) {
        const report = await api(`/api/excavations/${button.dataset.checks}/checks`);
        document.getElementById(`checks-${button.dataset.checks}`).innerHTML = `
          <ul class="check">
            <li>Без координат: ${report.missing_coordinates.length}</li>
            <li>Без размеров: ${report.missing_dimensions.length}</li>
            <li>Без фото: ${report.missing_photos.length}</li>
            <li>Без пласта: ${report.missing_layers.length}</li>
            <li>Elev вне пласта: ${report.elev_outside_layer.length}</li>
            <li>Вне контура GNSS: ${report.outside_contour.length}</li>
          </ul>`;
      }
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  const form = document.getElementById("excavation-form");
  if (!form) return;
  const draft = bindDraft(form, "draft-excavation");
  const retry = document.getElementById("retry-excavation");
  const submit = async () => {
    const raw = formValues(form);
    const body = {
      code: raw.code.trim(),
      year: Number(raw.year),
      center_north: num(raw.center_north),
      center_east: num(raw.center_east),
      center_elev: num(raw.center_elev),
      description: raw.description || null,
      boundaries: raw.boundaries || null,
      area_m2: num(raw.area_m2),
      grid_step_m: num(raw.grid_step_m) || 5,
    };
    setStatus("Отправка раскопа…");
    try {
      await api("/api/excavations", { method: "POST", body, idempotencyKey: draft.idempotencyKey });
      draft.clear();
      invalidateExcavations();
      setStatus("Раскоп создан", "ok");
      renderExcavations(root);
    } catch (error) {
      retry.hidden = false;
      setStatus(error.message, "error");
    }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  retry.addEventListener("click", submit);
}
