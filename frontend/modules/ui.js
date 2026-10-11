import { html, useEffect, useState } from "./html.js";
import { useRouter } from "./router.js";

export function Field({ label, children }) {
  const labelId = globalThis.React.useId();
  const controls = globalThis.React.Children.map(children, (child) =>
    globalThis.React.isValidElement(child)
      ? globalThis.React.cloneElement(child, { "aria-labelledby": labelId })
      : child);
  return html`<label className="field"><span id=${labelId}>${label}</span>${controls}</label>`;
}

export function SectionHeading({ children }) {
  return html`<h2 className="section-heading"><span>${children}</span></h2>`;
}

export function Breadcrumbs({ items }) {
  const { navigate } = useRouter();
  return html`<nav className="breadcrumbs" aria-label="Хлебные крошки">
    ${items.map((item, index) => html`<span key=${item.label}>
      ${index ? html`<span className="breadcrumbs__sep">/</span>` : null}
      ${item.href
        ? html`<button type="button" onClick=${() => navigate(item.href)}>${item.label}</button>`
        : html`<span className="breadcrumbs__current">${item.label}</span>`}
    </span>`)}
  </nav>`;
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const items = [];
  for (let number = 1; number <= pages; number += 1) {
    if (number === 1 || number === pages || Math.abs(number - page) <= 1) items.push(number);
    else if (items[items.length - 1] !== "…") items.push("…");
  }
  return html`<nav className="pagination" aria-label="Страницы">
    ${items.map((item, index) => item === "…"
      ? html`<span key=${`gap-${index}`} className="pagination__gap">…</span>`
      : html`<button key=${item} type="button" className=${item === page ? "is-current" : ""} onClick=${() => onPage(item)}>${item}</button>`)}
  </nav>`;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return html`<div className="modal" role="presentation" onClick=${onClose}>
    <div className="modal__dialog" role="dialog" aria-modal="true" aria-label=${title} onClick=${(event) => event.stopPropagation()}>
      <div className="modal__head">
        <h3>${title}</h3>
        <button type="button" className="btn btn-text" onClick=${onClose}>Закрыть</button>
      </div>
      ${children}
    </div>
  </div>`;
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }) {
  return html`<${Modal} title=${title} onClose=${onClose}>
    <p>${text}</p>
    <div className="actions">
      <button type="button" className="btn btn-gold" onClick=${onConfirm}>${confirmLabel}</button>
      <button type="button" className="btn btn-line" onClick=${onClose}>Отмена</button>
    </div>
  <//>`;
}

export function Empty({ children }) {
  return html`<p className="empty">${children}</p>`;
}

export function ErrorText({ error }) {
  if (!error) return null;
  return html`<p className="form-error" role="alert">${error.message || String(error)}</p>`;
}

export function useDraft(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? { ...initial, ...JSON.parse(saved) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  const clear = () => {
    sessionStorage.removeItem(key);
    setValue(initial);
  };
  return [value, setValue, clear];
}
