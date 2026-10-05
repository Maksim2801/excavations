import { html, useState } from "./html.js";
import { useQuery } from "../hooks/useQuery.js";
import { auditApi, dictionariesApi, usersApi } from "../services/api.js";
import { useStatus } from "./status.js";
import { ROLE_LABELS } from "./labels.js";
import { Breadcrumbs, ErrorText, Field, Modal, SectionHeading } from "./ui.js";

export function DictionariesPage() {
  const { setStatus } = useStatus();
  const query = useQuery(() => dictionariesApi.list(), []);
  const [open, setOpen] = useState(false);
  const data = query.data;

  const add = async (event) => {
    event.preventDefault();
    try {
      await dictionariesApi.addMaterial(Object.fromEntries(new FormData(event.target).entries()));
      setOpen(false);
      setStatus("Материал добавлен", "ok");
      query.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  const toggle = async (kind, item) => {
    const path = { materials: "materials", photo_types: "photo-types", gnss_point_types: "gnss-types", measurement_methods: "measurement-methods" }[kind];
    try {
      if (kind === "materials") await dictionariesApi.updateMaterial(item.id, { is_active: !item.is_active });
      else if (kind === "color_schemes") await dictionariesApi.updateNamed("color-schemes", item.id, { is_default: !item.is_default, is_active: true });
      else await dictionariesApi.updateNamed(path, item.id, { is_active: !item.is_active });
      query.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "Справочники" }]} />
    <div className="title-row">
      <${SectionHeading}>Справочники<//>
      <button type="button" className="btn btn-gold" onClick=${() => setOpen(true)}>Новый материал</button>
    </div>
    <${ErrorText} error=${query.error} />
    ${[["materials", "Материалы"], ["photo_types", "Типы фото"], ["gnss_point_types", "Типы GNSS"], ["measurement_methods", "Способы измерения"], ["color_schemes", "Цветовые схемы плана"]].map(([key, title]) => html`<div key=${key}>
      <h3 className="subhead">${title}</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Название</th><th>Код</th><th>Состояние</th><th></th></tr></thead>
        <tbody>${(data?.[key] || []).map((item) => html`<tr key=${item.id}>
          <td>${item.color ? html`<i className="swatch" style=${{ background: item.color }}></i>` : null}${item.name}</td>
          <td>${item.code || item.mode || "—"}</td>
          <td>${key === "color_schemes" ? (item.is_default ? "по умолчанию" : "запасная") : (item.is_active ? "активен" : "скрыт")}</td>
          <td><button type="button" className="btn btn-text" onClick=${() => toggle(key, item)}>${key === "color_schemes" ? "Сделать основной" : (item.is_active ? "Скрыть" : "Вернуть")}</button></td>
        </tr>`)}</tbody>
      </table></div>
    </div>`)}
    ${open ? html`<${Modal} title="Новый материал" onClose=${() => setOpen(false)}>
      <form className="stack" onSubmit=${add}>
        <${Field} label="Название"><input name="name" required /></${Field}>
        <${Field} label="Код"><input name="code" /></${Field}>
        <${Field} label="Цвет"><input name="color" type="color" defaultValue="#5c6b73" /></${Field}>
        <div className="actions"><button className="btn btn-gold" type="submit">Добавить</button></div>
      </form>
    <//>` : null}
  </section>`;
}

export function UsersPage() {
  const { setStatus } = useStatus();
  const users = useQuery(() => usersApi.list(), []);
  const audit = useQuery(() => auditApi.list().catch(() => []), []);
  const [open, setOpen] = useState(false);

  const create = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await usersApi.create(data);
      setOpen(false);
      setStatus("Пользователь создан", "ok");
      users.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  const update = async (user, patch) => {
    try {
      await usersApi.update(user.id, patch);
      setStatus("Пользователь обновлён", "ok");
      users.reload();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };

  return html`<section>
    <${Breadcrumbs} items=${[{ label: "Раскопы", href: "/excavations" }, { label: "Пользователи" }]} />
    <div className="title-row">
      <${SectionHeading}>Пользователи<//>
      <button type="button" className="btn btn-gold" onClick=${() => setOpen(true)}>Новый пользователь</button>
    </div>
    <${ErrorText} error=${users.error} />
    <div className="table-wrap"><table>
      <thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Почта</th><th>Доступ</th></tr></thead>
      <tbody>${(users.data || []).map((user) => html`<tr key=${user.id}>
        <td>${user.full_name}</td>
        <td>${user.username}</td>
        <td><select value=${user.role} onChange=${(event) => update(user, { role: event.target.value })}>
          ${Object.entries(ROLE_LABELS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}
        </select></td>
        <td>${user.email || "—"}</td>
        <td><button type="button" className="btn btn-text" onClick=${() => update(user, { is_active: !user.is_active })}>${user.is_active ? "Отключить" : "Включить"}</button></td>
      </tr>`)}</tbody>
    </table></div>
    <h3 className="subhead">Журнал</h3>
    <div className="table-wrap"><table>
      <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead>
      <tbody>${(audit.data || []).map((item) => html`<tr key=${item.id}>
        <td>${String(item.at || item.created_at || "").replace("T", " ").slice(0, 16)}</td>
        <td>${item.user_name || item.username || item.user_id}</td>
        <td>${item.action}</td>
        <td>${item.entity} ${item.entity_id}</td>
        <td>${item.details || ""}</td>
      </tr>`)}</tbody>
    </table></div>
    ${open ? html`<${Modal} title="Новый пользователь" onClose=${() => setOpen(false)}>
      <form className="stack" onSubmit=${create}>
        <${Field} label="Логин"><input name="username" required minlength="3" /></${Field}>
        <${Field} label="Полное имя"><input name="full_name" required /></${Field}>
        <${Field} label="Почта"><input name="email" type="email" /></${Field}>
        <${Field} label="Пароль"><input name="password" type="password" minlength="8" required /></${Field}>
        <${Field} label="Роль"><select name="role">${Object.entries(ROLE_LABELS).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}</select></${Field}>
        <div className="actions"><button className="btn btn-gold" type="submit">Создать</button></div>
      </form>
    <//>` : null}
  </section>`;
}
