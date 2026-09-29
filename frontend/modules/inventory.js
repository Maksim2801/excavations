import { api } from "./api.js";
import { allow, loadExcavations, navigate, setExcavation, setLayer, state } from "./context.js";
import { esc, field, fmt, issues, METHOD_LABELS, options, setStatus } from "./ui.js";

const SORTS = [
  ["code", "Код"], ["number", "Номер"], ["north", "North"], ["east", "East"], ["elev", "Elev"],
  ["length_mm", "Длина"], ["width_mm", "Ширина"], ["thickness_mm", "Толщина"],
];

export async function renderInventory(root) {
  const excavations = await loadExcavations();
  const excavationId = state.excavationId || "";
  const layers = excavationId ? await api(`/api/layers?excavation_id=${excavationId}`) : [];
  const dictionaries = await api("/api/dictionaries");
  root.innerHTML = `
    <section class="panel stack">
      <div class="actions">
        <h2>Опись</h2>
        <button class="btn btn-primary" id="new-finding" type="button">Новая находка</button>
        ${allow(2) ? `<button class="btn btn-ghost" id="to-reports" type="button">Экспорт</button>` : ""}
      </div>
      <form id="filters" class="filters">
        ${field("Раскоп", `<select name="excavation_id">${options(excavations, excavationId, (item) => item.id, (item) => `${item.code} (${item.year})`, "Все")}</select>`)}
        ${field("Пласт", `<select name="layer_id">${options(layers, state.layerId, (item) => item.id, (item) => `Пласт ${item.number}`, "Все")}</select>`)}
        ${field("Поиск", `<input name="q" placeholder="код, описание, квадрат">`)}
        ${field("Код", `<input name="code">`)}
        ${field("Материал", `<select name="material">${options(dictionaries.materials.filter((item) => item.is_active), "", (item) => item.name, (item) => item.name, "Все")}</select>`)}
        ${field("Квадрат", `<input name="square">`)}
        ${field("Способ", `<select name="measurement_method">${options([{id:"photo",name:"по фото"},{id:"manual",name:"ручное"},{id:"none",name:"не указан"}], "", (item) => item.id, (item) => item.name, "Все")}</select>`)}
        ${field("Фото", `<select name="photo_present"><option value="">Все</option><option value="true">Есть</option><option value="false">Нет</option></select>`)}
        ${field("Номер от", `<input name="number_from" type="number">`)}
        ${field("Номер до", `<input name="number_to" type="number">`)}
        ${field("Elev от", `<input name="elev_from" type="number" step="0.001">`)}
        ${field("Elev до", `<input name="elev_to" type="number" step="0.001">`)}
        <div class="actions"><button class="btn btn-primary" type="submit">Фильтр</button><button class="btn btn-ghost" id="reset" type="button">Сбросить</button></div>
      </form>
      <div class="table-wrap"><table><thead><tr>
        <th data-sort="code">Код</th><th>Раскоп</th><th data-sort="layer">Пласт</th>
        ${SORTS.filter(([key]) => key !== "code").map(([key, label]) => `<th data-sort="${key}">${label}</th>`).join("")}
        <th>Способ измерения</th><th>Фото</th><th>Замечания</th><th></th>
      </tr></thead><tbody id="rows"></tbody></table></div>
      <div class="pager"><button class="btn btn-ghost" id="prev" type="button">Назад</button><span id="page"></span><button class="btn btn-ghost" id="next" type="button">Дальше</button></div>
    </section>`;
  let page = 1;
  let sort = "code";
  let order = "asc";
  const load = async () => {
    const params = new URLSearchParams(new FormData(document.getElementById("filters")));
    for (const [key, value] of [...params.entries()]) if (!value) params.delete(key);
    params.set("page", String(page));
    params.set("page_size", "50");
    params.set("sort", sort);
    params.set("order", order);
    setStatus("Загрузка описи…");
    const data = await api(`/api/findings?${params.toString()}`);
    document.getElementById("rows").innerHTML = data.items.map((item) => `
      <tr class="${item.issues?.length ? "problem" : ""}">
        <td>${esc(item.code)}</td><td>${esc(item.excavation_code || "")}</td><td>${item.layer_number ?? "-"}</td><td>${item.number}</td>
        <td>${fmt(item.north)}</td><td>${fmt(item.east)}</td><td>${fmt(item.elev)}</td>
        <td>${fmt(item.length_mm, 1)}</td><td>${fmt(item.width_mm, 1)}</td><td>${fmt(item.thickness_mm, 1)}</td>
        <td>${esc(METHOD_LABELS[item.measurement_method] || item.measurement_method)}</td>
        <td>${item.photo_present ? "да" : "нет"}</td>
        <td>${item.issues?.length ? `<span class="badge warn">${esc(issues(item.issues))}</span>` : ""}</td>
        <td class="actions">
          <button class="btn btn-ghost" data-open="${item.id}" type="button">Карточка</button>
          <button class="btn btn-ghost" data-photo="${item.id}" type="button">Фото</button>
          <button class="btn btn-ghost" data-plan="${item.id}" data-excavation="${item.excavation_id}" data-layer="${item.layer_id || ""}" type="button">План</button>
          ${allow(2) ? `<button class="btn btn-danger" data-delete="${item.id}" type="button">Удалить</button>` : ""}
        </td>
      </tr>`).join("") || `<tr><td colspan="12">Записей нет</td></tr>`;
    document.getElementById("page").textContent = `Стр. ${data.page}, всего ${data.total}`;
    document.getElementById("rows").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        if (button.dataset.open) navigate(`/finding/${button.dataset.open}`);
        if (button.dataset.photo) navigate(`/photo/${button.dataset.photo}`);
        if (button.dataset.plan) {
          setExcavation(button.dataset.excavation);
          if (button.dataset.layer) setLayer(button.dataset.layer);
          navigate(`/plan?finding=${button.dataset.plan}`);
        }
        if (button.dataset.delete) {
          if (!confirm("Удалить находку?")) return;
          try {
            await api(`/api/findings/${button.dataset.delete}`, { method: "DELETE" });
            setStatus("Находка удалена", "ok");
            load();
          } catch (error) { setStatus(error.message, "error"); }
        }
      });
    });
    setStatus("");
  };
  document.getElementById("filters").addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedExcavation = event.target.excavation_id.value;
    const selectedLayer = event.target.layer_id.value;
    setExcavation(selectedExcavation);
    setLayer(selectedLayer);
    page = 1;
    if (selectedExcavation !== excavationId) renderInventory(root);
    else load().catch((error) => setStatus(error.message, "error"));
  });
  document.getElementById("filters").excavation_id.addEventListener("change", () => {
    setExcavation(document.getElementById("filters").excavation_id.value);
    setLayer("");
    renderInventory(root);
  });
  document.getElementById("reset").addEventListener("click", () => { setLayer(""); renderInventory(root); });
  document.getElementById("new-finding").addEventListener("click", () => navigate("/finding/new"));
  document.getElementById("to-reports")?.addEventListener("click", () => navigate("/reports"));
  document.querySelectorAll("[data-sort]").forEach((header) => header.addEventListener("click", () => {
    const key = header.dataset.sort;
    order = sort === key && order === "asc" ? "desc" : "asc";
    sort = key;
    load().catch((error) => setStatus(error.message, "error"));
  }));
  document.getElementById("prev").addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
  document.getElementById("next").addEventListener("click", () => { page += 1; load(); });
  await load();
}
