import { api, clearToken, getToken, setToken, setUnauthorized } from "./modules/api.js";
import { allow, navigate, setNavigator, state } from "./modules/context.js";
import { setStatus } from "./modules/ui.js";
import { renderExcavations } from "./modules/excavations.js";
import { renderLayers } from "./modules/layers.js";
import { renderInventory } from "./modules/inventory.js";
import { renderFinding } from "./modules/finding.js";
import { renderPlan } from "./modules/plan.js";
import { renderPhoto } from "./modules/photo.js";
import { renderGnss } from "./modules/gnss.js";
import { renderReports } from "./modules/reports.js";
import { renderAdmin } from "./modules/admin.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");
const who = document.getElementById("who");
const connection = document.getElementById("connection");
const logout = document.getElementById("logout");

const routes = [
  ["excavations", "Раскопы", () => true],
  ["layers", "Пласты", () => true],
  ["inventory", "Опись", () => true],
  ["plan", "План", () => true],
  ["photo", "Фотоанализ", () => true],
  ["gnss", "GNSS", () => true],
  ["reports", "Отчёты", () => allow(2)],
  ["dictionaries", "Справочники", () => allow(3)],
  ["users", "Пользователи", () => allow(3)],
];

setNavigator((path) => {
  const next = path.startsWith("#") ? path : `#/${path.replace(/^\//, "")}`;
  if (location.hash === next) render();
  else location.hash = next;
});
setUnauthorized(() => {
  state.user = null;
  setStatus("Сессия истекла. Войдите снова.", "warn");
  navigate("/login");
});

function route() {
  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts : ["inventory"];
}

function paintChrome() {
  const [name] = route();
  nav.innerHTML = routes.filter((item) => item[2]()).map(([id, label]) =>
    `<button type="button" data-go="${id}" class="${name === id ? "active" : ""}">${label}</button>`
  ).join("");
  who.textContent = state.user ? `${state.user.full_name} · ${state.user.role_label}` : "";
  logout.hidden = !state.user;
  connection.textContent = state.online ? "связь есть" : "нет связи";
  connection.className = `pill ${state.online ? "online" : "offline"}`;
}

async function render() {
  paintChrome();
  if (!state.user) {
    renderLogin();
    return;
  }
  const parts = route();
  app.innerHTML = "";
  try {
    if (parts[0] === "excavations") await renderExcavations(app);
    else if (parts[0] === "layers") await renderLayers(app);
    else if (parts[0] === "inventory") await renderInventory(app);
    else if (parts[0] === "finding") await renderFinding(app, parts[1] || "new");
    else if (parts[0] === "plan") await renderPlan(app);
    else if (parts[0] === "photo") await renderPhoto(app, parts[1]);
    else if (parts[0] === "gnss") await renderGnss(app);
    else if (parts[0] === "reports" && allow(2)) await renderReports(app);
    else if ((parts[0] === "dictionaries" || parts[0] === "users") && allow(3)) await renderAdmin(app, parts[0]);
    else navigate("/inventory");
  } catch (error) {
    app.innerHTML = `<section class="panel"><h2>Не удалось открыть раздел</h2><p>${error.message}</p><button class="btn btn-primary" id="retry" type="button">Повторить</button></section>`;
    document.getElementById("retry")?.addEventListener("click", render);
    setStatus(error.message, "error");
  }
}

function renderLogin() {
  nav.innerHTML = "";
  app.innerHTML = `
    <section class="login">
      <h2>Вход в полевую опись</h2>
      <form id="login-form" class="stack">
        <label class="field"><span>Имя пользователя</span><input name="username" required autocomplete="username"></label>
        <label class="field"><span>Пароль</span><input name="password" type="password" required autocomplete="current-password"></label>
        <div class="actions"><button class="btn btn-primary" type="submit">Войти</button></div>
      </form>
      <h3>Регистрация полевого археолога</h3>
      <form id="register-form" class="stack">
        <label class="field"><span>Имя пользователя</span><input name="username" required></label>
        <label class="field"><span>Полное имя</span><input name="full_name" required></label>
        <label class="field"><span>Почта</span><input name="email" type="email"></label>
        <label class="field"><span>Пароль</span><input name="password" type="password" minlength="8" required></label>
        <div class="actions"><button class="btn btn-ghost" type="submit">Зарегистрироваться</button></div>
      </form>
      <p class="muted">Демо: supervisor_arch / SuperArch1, camera_arch / CameraArch1, field_arch / FieldArch1</p>
    </section>`;
  document.getElementById("login-form").addEventListener("submit", (event) => submitAuth(event, "/api/auth/login"));
  document.getElementById("register-form").addEventListener("submit", (event) => submitAuth(event, "/api/auth/register"));
}

async function submitAuth(event, path) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  if (!data.email) delete data.email;
  setStatus("Отправка…");
  try {
    const result = await api(path, { method: "POST", body: data });
    setToken(result.access_token);
    state.user = result.user;
    setStatus("Вход выполнен", "ok");
    navigate("/inventory");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

nav.addEventListener("click", (event) => {
  const target = event.target.closest("[data-go]");
  if (target) navigate(target.dataset.go);
});
logout.addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } catch { /* локальный выход всё равно завершает сессию */ }
  clearToken();
  state.user = null;
  navigate("/login");
});

async function ping() {
  try {
    const response = await fetch("/api/health");
    state.online = response.ok;
  } catch {
    state.online = false;
  }
  if (connection) {
    connection.textContent = state.online ? "связь есть" : "нет связи";
    connection.className = `pill ${state.online ? "online" : "offline"}`;
  }
}
window.addEventListener("online", ping);
window.addEventListener("offline", () => { state.online = false; ping(); });
setInterval(ping, 15000);
window.addEventListener("hashchange", render);

async function boot() {
  await ping();
  if (getToken()) {
    try { state.user = await api("/api/auth/me"); }
    catch { state.user = null; clearToken(); }
  }
  if (!location.hash) location.hash = state.user ? "#/inventory" : "#/login";
  else render();
}
boot();
