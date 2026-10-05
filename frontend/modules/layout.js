import { html, useEffect, useState } from "./html.js";
import { useRouter } from "./router.js";
import { useSession } from "./session.js";
import { useStatus } from "./status.js";
import { allow } from "./labels.js";
import { Modal } from "./ui.js";

function Icon({ name }) {
  const paths = {
    search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3",
    eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    up: "M12 19V6M6 11l6-6 6 6",
  };
  return html`<svg className=${`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d=${paths[name]} />
  </svg>`;
}

export function Layout({ nav, children }) {
  const { path, navigate } = useRouter();
  const { user, logout, mode, changeMode } = useSession();
  const { text, kind } = useStatus();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [contrast, setContrast] = useState(() => document.documentElement.dataset.contrast === "1");

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visible = nav.filter((item) => allow(user, item[2]));

  const submitSearch = (event) => {
    event.preventDefault();
    setSearchOpen(false);
    navigate(`/inventory?q=${encodeURIComponent(query.trim())}`);
  };

  return html`<div className="page">
    <div className="top-line"></div>
    <header className="site-header">
      <div className="container header-top">
        <p className="logo">Полевая опись</p>
        <div className="header-tools">
          <button type="button" className="icon-button" aria-label="Поиск" onClick=${() => setSearchOpen(true)}><${Icon} name="search" /></button>
          <button type="button" className="icon-button" aria-label="Версия для слабовидящих" aria-pressed=${contrast} onClick=${() => {
            const next = !contrast;
            document.documentElement.dataset.contrast = next ? "1" : "0";
            setContrast(next);
          }}><${Icon} name="eye" /></button>
          <label className="mode-switch">
            <span>Данные</span>
            <select value=${mode} onChange=${(event) => changeMode(event.target.value)} aria-label="Источник данных">
              <option value="live">Сервер</option>
              <option value="mock">Локально</option>
            </select>
          </label>
        </div>
      </div>
      <nav className="main-nav container" aria-label="Разделы">
        ${visible.map(([href, label]) => html`<button type="button" key=${href} className=${path === href || path.startsWith(`${href}/`) ? "is-active" : ""} onClick=${() => navigate(href)}>${label}</button>`)}
      </nav>
    </header>
    <div className="session-bar">
      <div className="container session-bar__inner">
        <span>${user ? `${user.full_name} · ${user.role_label}` : ""}</span>
        <button type="button" className="btn btn-text" onClick=${async () => { await logout(); navigate("/login"); }}>Выход</button>
      </div>
    </div>
    <div className=${`status-line ${kind}`} role="status">${text}</div>
    <main className="container main">${children}</main>
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p className="logo logo-footer">Полевая опись</p>
          <p>Полевой учёт раскопов, пластов и находок. Координаты — локальная система: East, North, Elev.</p>
          <p className="footer-meta">Демонстрационный комплект полевой документации</p>
        </div>
        <div>
          <h3>Учёт</h3>
          <button type="button" onClick=${() => navigate("/excavations")}>Раскопы</button>
          <button type="button" onClick=${() => navigate("/layers")}>Пласты</button>
          <button type="button" onClick=${() => navigate("/inventory")}>Опись</button>
        </div>
        <div>
          <h3>Поле</h3>
          <button type="button" onClick=${() => navigate("/plan")}>План</button>
          <button type="button" onClick=${() => navigate("/photo")}>Фотоанализ</button>
          <button type="button" onClick=${() => navigate("/gnss")}>GNSS</button>
        </div>
        <div>
          <h3>Камералка</h3>
          <button type="button" onClick=${() => navigate("/reports")}>Отчёты</button>
          <button type="button" onClick=${() => navigate("/dictionaries")}>Справочники</button>
          <button type="button" onClick=${() => navigate("/users")}>Пользователи</button>
        </div>
        <div>
          <h3>Роли</h3>
          <p>Полевой археолог ведёт находки, фото, план и GNSS.</p>
          <p>Камеральный сотрудник правит пласты и выгружает описи.</p>
          <p>Руководитель архивирует раскопы и подтверждает описи.</p>
        </div>
      </div>
    </footer>
    <button type="button" className=${`to-top ${showTop ? "is-visible" : ""}`} aria-label="Наверх" onClick=${() => window.scrollTo({ top: 0, behavior: "smooth" })}><${Icon} name="up" /></button>
    ${searchOpen ? html`<${Modal} title="Поиск по описи" onClose=${() => setSearchOpen(false)}>
      <form className="stack" onSubmit=${submitSearch}>
        <label className="field"><span>Код, описание или квадрат</span><input value=${query} onInput=${(event) => setQuery(event.target.value)} autofocus /></label>
        <div className="actions"><button className="btn btn-gold" type="submit">Найти</button></div>
      </form>
    <//>` : null}
  </div>`;
}

export function terrainSrc(seed, title) {
  const tones = [
    ["#6e5138", "#3d3128", "#8d704e"],
    ["#4e5b45", "#2c332c", "#7d8a68"],
    ["#6a5348", "#322820", "#a48462"],
    ["#58544a", "#2a2824", "#8a8172"],
  ];
  const [a, b, c] = tones[seed % tones.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${b}"/><circle cx="90" cy="120" r="110" fill="${a}" opacity="0.85"/><circle cx="280" cy="250" r="150" fill="${c}" opacity="0.55"/><path d="M0 250 C80 210 140 300 220 250 C300 200 340 280 400 240 V400 H0 Z" fill="${b}" opacity="0.65"/><text x="24" y="48" fill="none">${title || ""}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
