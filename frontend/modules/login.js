import { html, useState } from "./html.js";
import { useRouter } from "./router.js";
import { useSession } from "./session.js";
import { useStatus } from "./status.js";
import { Field, ErrorText } from "./ui.js";
import { authApi, resetMock, getMode } from "../services/api.js";

export function LoginPage() {
  const { applyAuth } = useSession();
  const { navigate } = useRouter();
  const { setStatus } = useStatus();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (path) => async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!data.email) delete data.email;
    setBusy(true);
    setError("");
    setStatus("Отправка…");
    try {
      const result = path === "login" ? await authApi.login(data) : await authApi.register(data);
      applyAuth(result);
      setStatus("Вход выполнен", "ok");
      navigate("/excavations");
    } catch (err) {
      setError(err.message);
      setStatus(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return html`<section className="login">
    <p className="eyebrow">Полевая документация</p>
    <h1>Вход в опись находок</h1>
    <p className="lead">Источник данных: ${getMode() === "mock" ? "локальное хранилище в браузере" : "сервер API"}.</p>
    <form className="stack card-frame" onSubmit=${submit("login")}>
      <${Field} label="Имя пользователя"><input name="username" required autocomplete="username" /></${Field}>
      <${Field} label="Пароль"><input name="password" type="password" required autocomplete="current-password" /></${Field}>
      <${ErrorText} error=${error ? { message: error } : null} />
      <div className="actions"><button className="btn btn-gold" type="submit" disabled=${busy}>Войти</button></div>
    </form>
    <h2 className="section-heading"><span>Регистрация полевого археолога</span></h2>
    <form className="stack card-frame" onSubmit=${submit("register")}>
      <${Field} label="Имя пользователя"><input name="username" required /></${Field}>
      <${Field} label="Полное имя"><input name="full_name" required /></${Field}>
      <${Field} label="Почта"><input name="email" type="email" /></${Field}>
      <${Field} label="Пароль"><input name="password" type="password" minlength="8" required /></${Field}>
      <div className="actions"><button className="btn btn-line" type="submit" disabled=${busy}>Зарегистрироваться</button></div>
    </form>
    <p className="muted">Демо: supervisor_arch / SuperArch1, camera_arch / CameraArch1, field_arch / FieldArch1</p>
    ${getMode() === "mock" ? html`<button type="button" className="btn btn-text" onClick=${() => { resetMock(); setStatus("Локальные данные сброшены", "ok"); }}>Сбросить локальные данные</button>` : null}
  </section>`;
}
