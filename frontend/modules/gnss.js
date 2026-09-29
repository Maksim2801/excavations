import { api } from "./api.js";
import { loadExcavations, setExcavation, state } from "./context.js";
import { esc, field, options, setStatus } from "./ui.js";

export async function renderGnss(root) {
  const excavations = await loadExcavations();
  const excavationId = state.excavationId || excavations[0]?.id || "";
  const points = excavationId ? await api(`/api/gnss?excavation_id=${excavationId}`) : [];
  root.innerHTML = `
    <section class="panel stack">
      <h2>Импорт GNSS</h2>
      <form id="gnss-form" class="filters">
        ${field("Раскоп", `<select name="excavation_id">${options(excavations, excavationId, (item) => item.id, (item) => `${item.code} (${item.year})`)}</select>`)}
        ${field("CSV", `<input name="file" type="file" accept=".csv,text/csv" required>`)}
        <button class="btn btn-primary" type="submit">Проверить файл</button>
      </form>
      <p class="muted">Колонки: north, east, elev, point_type, comment. Типы: corner / control / auxiliary или угловая / контрольная / вспомогательная.</p>
      <div id="preview"></div>
      <h3>Точки раскопа</h3>
      <div class="table-wrap"><table><thead><tr><th>North</th><th>East</th><th>Elev</th><th>Тип</th><th>Комментарий</th></tr></thead>
      <tbody>${points.map((point) => `<tr><td>${point.north}</td><td>${point.east}</td><td>${point.elev}</td><td>${esc(point.point_type_label)}</td><td>${esc(point.comment || "")}</td></tr>`).join("") || `<tr><td colspan="5">Точек нет</td></tr>`}</tbody></table></div>
    </section>`;
  document.getElementById("gnss-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    setExcavation(form.excavation_id.value);
    const data = new FormData();
    data.append("excavation_id", form.excavation_id.value);
    data.append("file", form.file.files[0]);
    setStatus("Проверка CSV…");
    try {
      const preview = await api("/api/gnss/preview", { method: "POST", formData: data });
      drawPreview(preview, form.file.files[0].name, form.excavation_id.value);
      setStatus(`Корректных строк: ${preview.valid_count}, с ошибками: ${preview.error_count}`, preview.error_count ? "warn" : "ok");
    } catch (error) { setStatus(error.message, "error"); }
  });
}

function drawPreview(preview, sourceName, excavationId) {
  const node = document.getElementById("preview");
  node.innerHTML = `
    <p>Корректных: ${preview.valid_count}. Ошибочных: ${preview.error_count}. Ошибочные строки не будут сохранены молча.</p>
    <div class="table-wrap"><table><thead><tr><th></th><th>Строка</th><th>North</th><th>East</th><th>Elev</th><th>Тип</th><th>Комментарий</th><th>Статус</th></tr></thead>
    <tbody>${preview.rows.map((row, index) => `<tr class="${row.status === "error" ? "problem" : ""}">
      <td><input type="checkbox" data-index="${index}" ${row.status === "ok" ? "checked" : ""}></td>
      <td>${row.line}</td><td>${row.north ?? ""}</td><td>${row.east ?? ""}</td><td>${row.elev ?? ""}</td>
      <td><select data-type="${index}"><option value="corner" ${row.point_type === "corner" ? "selected" : ""}>Угловая</option><option value="control" ${row.point_type === "control" ? "selected" : ""}>Контрольная</option><option value="auxiliary" ${row.point_type === "auxiliary" ? "selected" : ""}>Вспомогательная</option></select></td>
      <td><input data-comment="${index}" value="${esc(row.comment || "")}"></td>
      <td>${row.status === "ok" ? "ok" : esc(row.errors.join("; "))}</td>
    </tr>`).join("")}</tbody></table></div>
    <button class="btn btn-primary" id="confirm-gnss" type="button">Подтвердить импорт</button>`;
  document.getElementById("confirm-gnss").onclick = async () => {
    const points = preview.rows.filter((_, index) => node.querySelector(`[data-index="${index}"]`).checked).map((row, _, all) => row).map((row) => {
      const index = preview.rows.indexOf(row);
      return {
        north: row.north,
        east: row.east,
        elev: row.elev,
        point_type: node.querySelector(`[data-type="${index}"]`).value,
        comment: node.querySelector(`[data-comment="${index}"]`).value,
      };
    });
    setStatus("Импорт точек…");
    try {
      const result = await api("/api/gnss/import", { method: "POST", body: { excavation_id: Number(excavationId), source_name: sourceName, points } });
      setStatus(`Импортировано: ${result.imported}. Отклонено: ${result.error_count}.`, result.error_count ? "warn" : "ok");
      renderGnss(document.getElementById("app"));
    } catch (error) { setStatus(error.message, "error"); }
  };
}
