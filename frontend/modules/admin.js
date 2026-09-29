import { api } from "./api.js";
import { esc, setStatus } from "./ui.js";

export async function renderAdmin(root, section) {
  if (section === "users") return renderUsers(root);
  const data = await api("/api/dictionaries");
  const audit = await api("/api/audit?limit=30");
  root.innerHTML = `
    <section class="panel stack">
      <h2>Справочники</h2>
      <h3>Материалы</h3>
      <form id="material-form" class="filters">
        <input name="name" placeholder="Название" required>
        <input name="code" placeholder="Код">
        <input name="color" type="color" value="#2f6b4f">
        <button class="btn btn-primary" type="submit">Добавить</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>Материал</th><th>Цвет</th><th>Активен</th></tr></thead><tbody>
        ${data.materials.map((item) => `<tr><td>${esc(item.name)}</td><td><i class="swatch" style="background:${esc(item.color)}"></i>${esc(item.color)}</td><td>${item.is_active ? "да" : "нет"}</td></tr>`).join("")}
      </tbody></table></div>
      <h3>Цветовые схемы плана</h3>
      ${data.color_schemes.map((item) => `<p>${esc(item.name)} · ${esc(item.mode)} ${item.is_default ? "(по умолчанию)" : ""} ${item.is_default ? "" : `<button class="btn btn-ghost" data-scheme="${item.id}" type="button">Сделать схемой по умолчанию</button>`}</p>`).join("")}
      <h3>Типы GNSS, фото и измерений</h3>
      <p>${data.gnss_point_types.map((item) => esc(item.name)).join(", ")}</p>
      <p>${data.photo_types.map((item) => esc(item.name)).join(", ")}</p>
      <p>${data.measurement_methods.map((item) => esc(item.name)).join(", ")}</p>
      <h3>Журнал</h3>
      <div class="table-wrap"><table><thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Сущность</th><th>Детали</th></tr></thead><tbody>
        ${audit.map((row) => `<tr><td>${esc(row.created_at)}</td><td>${esc(row.username || "")}</td><td>${esc(row.action)}</td><td>${esc(row.entity)}</td><td>${esc(row.details || "")}</td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
  document.getElementById("material-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api("/api/dictionaries/materials", { method: "POST", body: raw });
      setStatus("Материал добавлен", "ok");
      renderAdmin(root, "dictionaries");
    } catch (error) { setStatus(error.message, "error"); }
  });
  root.querySelectorAll("[data-scheme]").forEach((button) => button.addEventListener("click", async () => {
    await api(`/api/dictionaries/color-schemes/${button.dataset.scheme}`, { method: "PUT", body: { is_default: true } });
    setStatus("Цветовая схема обновлена", "ok");
    renderAdmin(root, "dictionaries");
  }));
}

async function renderUsers(root) {
  const users = await api("/api/users");
  root.innerHTML = `
    <section class="panel stack">
      <h2>Пользователи</h2>
      <form id="user-form" class="filters">
        <input name="username" placeholder="Логин" required>
        <input name="full_name" placeholder="Имя" required>
        <input name="password" type="password" placeholder="Пароль" required minlength="8">
        <select name="role"><option value="field_archaeologist">Полевой археолог</option><option value="camera_staff">Камеральный сотрудник</option><option value="supervisor">Руководитель работ</option></select>
        <button class="btn btn-primary" type="submit">Создать</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>Логин</th><th>Имя</th><th>Роль</th><th>Активен</th><th></th></tr></thead><tbody>
        ${users.map((user) => `<tr><td>${esc(user.username)}</td><td>${esc(user.full_name)}</td><td>
          <select data-role="${user.id}">${["field_archaeologist", "camera_staff", "supervisor"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${esc(role)}</option>`).join("")}</select>
        </td><td>${user.is_active ? "да" : "нет"}</td><td><button class="btn btn-ghost" data-save="${user.id}" type="button">Сохранить роль</button></td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
  document.getElementById("user-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api(`/api/users?role=${encodeURIComponent(raw.role)}`, {
        method: "POST",
        body: { username: raw.username, full_name: raw.full_name, password: raw.password },
      });
      setStatus("Пользователь создан", "ok");
      renderUsers(root);
    } catch (error) { setStatus(error.message, "error"); }
  });
  root.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", async () => {
    const role = root.querySelector(`[data-role="${button.dataset.save}"]`).value;
    try {
      await api(`/api/users/${button.dataset.save}`, { method: "PUT", body: { role } });
      setStatus("Роль обновлена", "ok");
    } catch (error) { setStatus(error.message, "error"); }
  }));
}
