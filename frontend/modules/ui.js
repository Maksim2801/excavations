export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function setStatus(text, kind = "") {
  const node = document.getElementById("status");
  if (!node) return;
  node.textContent = text || "";
  node.className = `status-line ${kind}`;
}

export function field(label, control) {
  return `<label class="field"><span>${label}</span>${control}</label>`;
}

export function options(items, selected, valueOf, labelOf, emptyLabel) {
  const head = emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : "";
  const body = items.map((item) => {
    const value = valueOf(item);
    const current = String(selected ?? "") === String(value) ? " selected" : "";
    return `<option value="${esc(value)}"${current}>${esc(labelOf(item))}</option>`;
  }).join("");
  return head + body;
}

export function formValues(form) {
  const data = {};
  for (const element of form.elements) {
    if (!element.name || element.disabled) continue;
    data[element.name] = element.value;
  }
  return data;
}

export function bindDraft(form, key) {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    saved = null;
  }
  if (saved?.values) {
    for (const [name, value] of Object.entries(saved.values)) {
      const input = form.elements.namedItem(name);
      if (input && "value" in input && document.activeElement !== input) input.value = value ?? "";
    }
  }
  const idempotencyKey = saved?.idempotencyKey || uuid();
  const persist = () => {
    sessionStorage.setItem(key, JSON.stringify({ values: formValues(form), idempotencyKey }));
  };
  form.addEventListener("input", persist);
  form.addEventListener("change", persist);
  return {
    idempotencyKey,
    clear() {
      sessionStorage.removeItem(key);
    },
  };
}

export function num(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function fmt(value, digits = 3) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : esc(value);
}

export const ISSUE_LABELS = {
  no_coordinates: "нет координат",
  no_dimensions: "нет размеров",
  no_photo: "нет фото",
  no_layer: "нет пласта",
  incomplete: "запись не завершена",
};

export const METHOD_LABELS = {
  none: "не указан",
  photo: "по фото",
  manual: "ручное",
};

export function issues(list) {
  return (list || []).map((item) => ISSUE_LABELS[item] || item).join(", ");
}
