import { api, download } from "./api.js";
import { allow, loadExcavations, state } from "./context.js";
import { esc, field, options, setStatus } from "./ui.js";

const COLUMNS = [
  ["code", "Код"], ["number", "Номер"], ["excavation", "Раскоп"], ["layer", "Пласт"], ["square", "Квадрат"],
  ["material", "Материал"], ["north", "North"], ["east", "East"], ["elev", "Elev"],
  ["length_mm", "Длина"], ["width_mm", "Ширина"], ["thickness_mm", "Толщина"],
  ["description", "Описание"], ["find_type", "Тип находки"], ["quantity", "Количество"],
  ["measurement_method", "Способ измерения"], ["photo_present", "Фото"], ["note", "Примечание"],
  ["vessel_part", "Часть сосуда"], ["ornament", "Орнамент"],
];
const MINIMAL = ["code", "number", "excavation", "layer", "square", "material", "north", "east", "elev", "length_mm", "width_mm", "thickness_mm"];

export async function renderReports(root) {
  const excavations = await loadExcavations();
  const dictionaries = await api("/api/dictionaries");
  const layers = state.excavationId ? await api(`/api/layers?excavation_id=${state.excavationId}`) : [];
  const templates = await api("/api/reports/templates");
  root.innerHTML = `
    <section class="panel stack">
      <h2>Отчёты</h2>
      <form id="report-form" class="stack">
        <div class="filters">
          ${field("Раскоп", `<select name="excavation_id">${options(excavations, state.excavationId, (item) => item.id, (item) => `${item.code} (${item.year})`, "Все")}</select>`)}
          ${field("Пласт", `<select name="layer_id">${options(layers, state.layerId, (item) => item.id, (item) => `Пласт ${item.number}`, "Все")}</select>`)}
          ${field("Квадрат", `<input name="square">`)}
          ${field("Материал", `<select name="material">${options(dictionaries.materials, "", (item) => item.name, (item) => item.name, "Все")}</select>`)}
          ${field("Тип находки", `<input name="find_type">`)}
          ${field("Способ", `<select name="measurement_method"><option value="">Все</option><option value="photo">по фото</option><option value="manual">ручное</option><option value="none">не указан</option></select>`)}
          ${field("Номер от", `<input name="number_from" type="number">`)}
          ${field("Номер до", `<input name="number_to" type="number">`)}
          ${field("Elev от", `<input name="elev_from" type="number" step="0.001">`)}
          ${field("Elev до", `<input name="elev_to" type="number" step="0.001">`)}
          ${field("Сортировка", `<select name="sort"><option value="number">по номеру</option><option value="square">по квадрату</option><option value="layer">по пласту</option><option value="combined">пласт, квадрат, номер</option><option value="code">по коду</option></select>`)}
        </div>
        <div class="actions" id="columns">${COLUMNS.map(([key, label]) => `<label class="badge"><input type="checkbox" name="columns" value="${key}" ${MINIMAL.includes(key) ? "checked" : ""}> ${label}</label>`).join("")}</div>
        <div class="actions">
          <button class="btn btn-ghost" type="button" id="preset-min">Минимальная опись</button>
          <button class="btn btn-ghost" type="button" id="preset-ext">Расширенная опись</button>
          <button class="btn btn-primary" type="submit">Предпросмотр</button>
          <button class="btn btn-ghost" id="xlsx" type="button">Excel</button>
          <button class="btn btn-ghost" id="pdf" type="button">PDF</button>
          <button class="btn btn-ghost" id="print" type="button">Печать</button>
        </div>
        <div class="actions">
          <input id="template-name" placeholder="Имя шаблона, например Раскоп 1 - полная опись">
          <button class="btn btn-ghost" id="save-template" type="button">Сохранить шаблон</button>
          <select id="templates">${options(templates, "", (item) => item.id, (item) => item.name, "Шаблоны")}</select>
          <button class="btn btn-ghost" id="apply-template" type="button">Применить</button>
        </div>
      </form>
      <div id="preview"></div>
    </section>`;
  const form = document.getElementById("report-form");
  const bodyFromForm = () => {
    const data = new FormData(form);
    const columns = data.getAll("columns");
    const payload = {
      excavation_id: data.get("excavation_id") ? Number(data.get("excavation_id")) : null,
      layer_id: data.get("layer_id") ? Number(data.get("layer_id")) : null,
      square: data.get("square") || null,
      material: data.get("material") || null,
      find_type: data.get("find_type") || null,
      measurement_method: data.get("measurement_method") || null,
      number_from: data.get("number_from") ? Number(data.get("number_from")) : null,
      number_to: data.get("number_to") ? Number(data.get("number_to")) : null,
      elev_from: data.get("elev_from") ? Number(data.get("elev_from")) : null,
      elev_to: data.get("elev_to") ? Number(data.get("elev_to")) : null,
      sort: data.get("sort") || "combined",
      order: "asc",
      columns,
    };
    return payload;
  };
  const setColumns = (keys) => {
    form.querySelectorAll("input[name=columns]").forEach((input) => { input.checked = keys.includes(input.value); });
  };
  document.getElementById("preset-min").onclick = () => setColumns(MINIMAL);
  document.getElementById("preset-ext").onclick = () => setColumns(COLUMNS.map(([key]) => key));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Формирование предпросмотра…");
    try {
      const preview = await api("/api/reports/findings", { method: "POST", body: bodyFromForm() });
      document.getElementById("preview").innerHTML = `<iframe title="Предпросмотр описи" style="width:100%;min-height:480px;border:1px solid #d9d0c3;background:white"></iframe>`;
      document.querySelector("#preview iframe").srcdoc = preview.html;
      setStatus(`В выборке ${preview.total} записей`, "ok");
    } catch (error) { setStatus(error.message, "error"); }
  });
  document.getElementById("xlsx").onclick = () => exportFile("xlsx");
  document.getElementById("pdf").onclick = () => exportFile("pdf");
  document.getElementById("print").onclick = async () => {
    try {
      const html = await api("/api/reports/print", { method: "POST", body: bodyFromForm() });
      const popup = window.open("", "_blank");
      if (!popup) { setStatus("Разрешите всплывающие окна для печати", "warn"); return; }
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (error) { setStatus(error.message, "error"); }
  };
  document.getElementById("save-template").onclick = async () => {
    const name = document.getElementById("template-name").value.trim();
    if (!name) { setStatus("Укажите имя шаблона", "warn"); return; }
    const filters = bodyFromForm();
    try {
      await api("/api/reports/templates", { method: "POST", body: { name, filters, columns: filters.columns, sort: { sort: filters.sort, order: filters.order } } });
      setStatus("Шаблон сохранён", "ok");
      renderReports(root);
    } catch (error) { setStatus(error.message, "error"); }
  };
  document.getElementById("apply-template").onclick = () => {
    const id = document.getElementById("templates").value;
    const template = templates.find((item) => String(item.id) === id);
    if (!template) return;
    const filters = template.filters || {};
    for (const [key, value] of Object.entries(filters)) {
      const input = form.elements.namedItem(key);
      if (input && key !== "columns" && value !== null && value !== undefined) input.value = value;
    }
    if (template.columns?.length) setColumns(template.columns);
    if (template.sort?.sort) form.elements.sort.value = template.sort.sort;
    setStatus(`Применён шаблон «${template.name}»`, "ok");
  };
  async function exportFile(format) {
    setStatus(`Экспорт ${format.toUpperCase()}…`);
    try {
      await download("/api/reports/export", { ...bodyFromForm(), format }, `opis.${format}`);
      setStatus("Файл сформирован", "ok");
    } catch (error) { setStatus(error.message, "error"); }
  }
  if (allow(3)) {
    const reports = await api("/api/reports");
    const box = document.createElement("div");
    box.innerHTML = `<h3>Подтверждение отчётов</h3>` + reports.map((item) => `<p>${esc(item.title)} · ${esc(item.format)} · ${esc(item.status)} ${item.status !== "confirmed" ? `<button class="btn btn-ghost" data-confirm="${item.id}" type="button">Подтвердить</button>` : ""}</p>`).join("");
    root.querySelector("section").append(box);
    box.querySelectorAll("[data-confirm]").forEach((button) => button.addEventListener("click", async () => {
      await api(`/api/reports/${button.dataset.confirm}/confirm`, { method: "POST" });
      setStatus("Отчёт подтверждён", "ok");
      renderReports(root);
    }));
  }
}
