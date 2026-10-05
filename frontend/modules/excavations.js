import { html, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { excavationsApi } from "../services/api.js";
import { useSession } from "./session.js";
import { useRouter } from "./router.js";
import { useWorkspace } from "./workspace.js";
import { useStatus } from "./status.js";
import { allow, fmt } from "./labels.js";
import { Breadcrumbs, Field, Modal, Pagination, SectionHeading, ErrorText } from "./ui.js";
import { terrainSrc } from "./layout.js";

const PAGE_SIZE = 6;

export function ExcavationsPage() {
  const { user } = useSession();
  const { navigate } = useRouter();
  const { excavationId, setExcavationId } = useWorkspace();
  const { setStatus } = useStatus();
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const query = useQuery(() => excavationsApi.list(), []);
  const items = (query.data || []).filter((item) => !year || String(item.year) === year);
  const years = [...new Set((query.data || []).map((item) => item.year))].sort((a, b) => b - a);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const create = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    setError(null);
    try {
      const created = await excavationsApi.create(data);
      setStatus(`Раскоп ${created.code} создан`, "ok");
      setOpen(false);
      setExcavationId(created.id);
      query.reload();
    } catch (err) {
      setError(err);
      setStatus(err.message, "error");
    }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Главная", href: "/excavations" }, { label: "Раскопы" }]} />
    <h1>Раскопы</h1>
    <div className="filter-strip">
      <div className="filter-bar">
        <label>Год <select value=${year} onChange=${(event) => { setYear(event.target.value); setPage(1); }}>
          <option value="">Все</option>
          ${years.map((item) => html`<option key=${item} value=${item}>${item}</option>`)}
        </select></label>
        <button type="button" className="reset-link" onClick=${() => { setYear(""); setPage(1); }}>Сбросить</button>
        ${allow(user, 3) ? html`<button type="button" className="btn btn-gold" onClick=${() => setOpen(true)}>Новый раскоп</button>` : html`<span className="muted">Создавать раскопы может руководитель работ.</span>`}
      </div>
    </div>
    ${query.loading ? html`<p>Загрузка…</p>` : null}
    <${ErrorText} error=${query.error} />
    <div className="card-grid">
      ${visible.map((item) => html`<a key=${item.id} className="expedition-card" href=${`/excavations/${item.id}`} onClick=${(event) => { event.preventDefault(); setExcavationId(item.id); navigate(`/excavations/${item.id}`); }}>
        <img alt="" src=${terrainSrc(item.id, item.code)} />
        <span className="expedition-card__overlay"></span>
        <h3>${item.code}</h3>
        <div className="expedition-card__meta">
          <span className="pin" aria-hidden="true"></span>
          <span>${item.place || item.description || "Поле"}</span>
          <strong>${item.year}</strong>
        </div>
      </a>`)}
    </div>
    ${!query.loading && !visible.length ? html`<p className="empty">Раскопов нет</p>` : null}
    <${Pagination} page=${Math.min(page, pages)} pages=${pages} onPage=${setPage} />
    <p className="muted">Рабочий раскоп: ${excavationId ? `№ ${excavationId}` : "не выбран"}. Карточка открывает паспорт раскопа.</p>
    ${open ? html`<${Modal} title="Новый раскоп" onClose=${() => setOpen(false)}>
      <form className="stack" onSubmit=${create}>
        <${Field} label="Код"><input name="code" required /></${Field}>
        <${Field} label="Год"><input name="year" type="number" required defaultValue="2026" /></${Field}>
        <${Field} label="Место"><input name="place" placeholder="Городище" /></${Field}>
        <${Field} label="Центр North"><input name="center_north" type="number" step="0.001" required /></${Field}>
        <${Field} label="Центр East"><input name="center_east" type="number" step="0.001" required /></${Field}>
        <${Field} label="Центр Elev"><input name="center_elev" type="number" step="0.001" required /></${Field}>
        <${Field} label="Площадь, м²"><input name="area_m2" type="number" step="0.1" /></${Field}>
        <${Field} label="Шаг сетки, м"><input name="grid_step_m" type="number" step="0.1" defaultValue="5" /></${Field}>
        <${Field} label="Описание"><textarea name="description"></textarea></${Field}>
        <${Field} label="Границы"><textarea name="boundaries"></textarea></${Field}>
        <${ErrorText} error=${error} />
        <div className="actions"><button className="btn btn-gold" type="submit">Создать раскоп</button></div>
      </form>
    <//>` : null}
  </section>`;
}

export function ExcavationPage({ id }) {
  const { user } = useSession();
  const { navigate } = useRouter();
  const { setExcavationId } = useWorkspace();
  const { setStatus } = useStatus();
  const [checks, setChecks] = useState(null);
  const query = useQuery(() => excavationsApi.get(id), [id]);
  const item = query.data;

  const run = async (action) => {
    try {
      if (action === "archive") await excavationsApi.archive(id);
      if (action === "restore") await excavationsApi.restore(id);
      if (action === "use") {
        setExcavationId(id);
        setStatus("Раскоп выбран рабочим", "ok");
        navigate("/inventory");
        return;
      }
      if (action === "checks") {
        setChecks(await excavationsApi.checks(id));
        return;
      }
      setStatus("Состояние раскопа обновлено", "ok");
      query.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  if (query.loading) return html`<p>Загрузка…</p>`;
  if (query.error) return html`<${ErrorText} error=${query.error} />`;
  if (!item) return null;

  return html`<article>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: `${item.code} · ${item.year}` }]} />
    <${SectionHeading}>${item.code}<//>
    <div className="detail-grid">
      <aside className="info-card">
        <p><span className="info-icon"></span>${item.year}</p>
        <p><span className="info-icon info-icon-pin"></span>${item.place || "Поле"}</p>
        <p>${item.status === "archived" ? "В архиве" : "Активный"}</p>
        <p>Центр N ${fmt(item.center_north)} · E ${fmt(item.center_east)} · Z ${fmt(item.center_elev)}</p>
        <p>Пласты ${item.layer_count} · находки ${item.finding_count} · GNSS ${item.gnss_count}</p>
        <div className="share"><span>Ссылка</span><button type="button" onClick=${async () => { await navigator.clipboard?.writeText(location.href); setStatus("Ссылка скопирована", "ok"); }}>Копировать</button></div>
      </aside>
      <div>
        <p className="lead">${item.description || "Описание раскопа пока не заполнено."}</p>
        <p className="article">${item.boundaries || ""}</p>
        <p className="article">Площадь ${fmt(item.area_m2, 1)} м², шаг сетки ${fmt(item.grid_step_m, 1)} м.</p>
      </div>
    </div>
    <div className="actions">
      <button type="button" className="btn btn-gold" onClick=${() => run("use")}>Сделать рабочим</button>
      <button type="button" className="btn btn-line" onClick=${() => run("checks")}>Проверить</button>
      <button type="button" className="btn btn-line" onClick=${() => navigate("/plan")}>Открыть план</button>
      ${allow(user, 3) && item.status === "active" ? html`<button type="button" className="btn btn-line" onClick=${() => run("archive")}>В архив</button>` : null}
      ${allow(user, 3) && item.status === "archived" ? html`<button type="button" className="btn btn-line" onClick=${() => run("restore")}>Вернуть</button>` : null}
    </div>
    ${checks ? html`<${Modal} title="Проверка раскопа" onClose=${() => setChecks(null)}>
      <ul className="check-list">
        <li>Без координат: ${checks.missing_coordinates.length}</li>
        <li>Без размеров: ${checks.missing_dimensions.length}</li>
        <li>Без фото: ${checks.missing_photos.length}</li>
        <li>Без пласта: ${checks.missing_layers.length}</li>
        <li>Отметка вне пласта: ${checks.elev_outside_layer.length}</li>
        <li>Вне контура: ${checks.outside_contour.length}</li>
      </ul>
    <//>` : null}
  </article>`;
}
