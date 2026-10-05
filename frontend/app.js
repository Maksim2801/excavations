import { html, useEffect } from "./modules/html.js";
import { Router, useRouter } from "./modules/router.js";
import { SessionProvider, useSession } from "./modules/session.js";
import { WorkspaceProvider } from "./modules/workspace.js";
import { StatusProvider } from "./modules/status.js";
import { Layout } from "./modules/layout.js";
import { LoginPage } from "./modules/login.js";
import { ExcavationPage, ExcavationsPage } from "./modules/excavations.js";
import { LayersPage } from "./modules/layers.js";
import { InventoryPage } from "./modules/inventory.js";
import { FindingPage } from "./modules/finding.js";
import { PlanPage } from "./modules/plan.js";
import { PhotoPage } from "./modules/photo.js";
import { GnssPage } from "./modules/gnss.js";
import { ReportsPage } from "./modules/reports.js";
import { DictionariesPage, UsersPage } from "./modules/admin.js";
import { allow } from "./modules/labels.js";

const NAV = [
  ["/excavations", "Раскопы", 1],
  ["/layers", "Пласты", 1],
  ["/inventory", "Опись", 1],
  ["/plan", "План", 1],
  ["/photo", "Фотоанализ", 1],
  ["/gnss", "GNSS", 1],
  ["/reports", "Отчёты", 2],
  ["/dictionaries", "Справочники", 3],
  ["/users", "Пользователи", 3],
];

function known(path) {
  return [
    /^\/excavations$/,
    /^\/excavations\/\d+$/,
    /^\/layers$/,
    /^\/inventory$/,
    /^\/findings\/new$/,
    /^\/findings\/\d+$/,
    /^\/plan$/,
    /^\/photo$/,
    /^\/photo\/\d+$/,
    /^\/gnss$/,
    /^\/reports$/,
    /^\/dictionaries$/,
    /^\/users$/,
  ].some((pattern) => pattern.test(path));
}

function Screen() {
  const { path } = useRouter();
  if (path === "/excavations") return html`<${ExcavationsPage} />`;
  if (/^\/excavations\/\d+$/.test(path)) return html`<${ExcavationPage} id=${Number(path.split("/")[2])} />`;
  if (path === "/layers") return html`<${LayersPage} />`;
  if (path === "/inventory") return html`<${InventoryPage} />`;
  if (path === "/findings/new") return html`<${FindingPage} id="new" />`;
  if (/^\/findings\/\d+$/.test(path)) return html`<${FindingPage} id=${path.split("/")[2]} />`;
  if (path === "/plan") return html`<${PlanPage} />`;
  if (path === "/photo" || /^\/photo\/\d+$/.test(path)) return html`<${PhotoPage} findingId=${path.split("/")[2] || ""} />`;
  if (path === "/gnss") return html`<${GnssPage} />`;
  if (path === "/reports") return html`<${ReportsPage} />`;
  if (path === "/dictionaries") return html`<${DictionariesPage} />`;
  if (path === "/users") return html`<${UsersPage} />`;
  return null;
}

function Shell() {
  const { path, navigate } = useRouter();
  const { user, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    if (!user && path !== "/login") navigate("/login");
    else if (user && (path === "/" || path === "/login")) navigate("/excavations");
    else if (user && path === "/reports" && !allow(user, 2)) navigate("/inventory");
    else if (user && (path === "/dictionaries" || path === "/users") && !allow(user, 3)) navigate("/inventory");
    else if (user && path !== "/login" && !known(path)) navigate("/excavations");
  }, [ready, user, path, navigate]);

  if (!ready) return html`<p className="boot">Загрузка…</p>`;
  if (!user) {
    return html`<div className="page">
      <div className="top-line"></div>
      <header className="site-header site-header-slim"><div className="container header-top"><p className="logo">Полевая опись</p></div></header>
      <main className="container main"><${LoginPage} /></main>
    </div>`;
  }
  return html`<${Layout} nav=${NAV}><${Screen} /><//>`;
}

const root = globalThis.ReactDOM.createRoot(document.getElementById("app"));
root.render(html`
  <${SessionProvider}>
    <${StatusProvider}>
      <${WorkspaceProvider}>
        <${Router}><${Shell} /><//>
      <//>
    <//>
  <//>
`);
