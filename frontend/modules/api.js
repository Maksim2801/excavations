const TOKEN_KEY = "archaeology_token";
let onUnauthorized = () => {};

export function setUnauthorized(handler) {
  onUnauthorized = handler;
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  let body = options.body;
  if (options.formData) {
    body = options.formData;
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, { method: options.method || "GET", headers, body });
  } catch {
    const error = new Error("Нет соединения с сервером. Введённые данные сохранены, повторите отправку.");
    error.offline = true;
    throw error;
  }
  if (response.status === 401 && token) {
    clearToken();
    onUnauthorized();
    throw Object.assign(new Error("Сессия истекла. Войдите снова."), { status: 401 });
  }
  if (!response.ok) {
    let detail = "Ошибка запроса";
    try {
      const data = await response.json();
      detail = typeof data.detail === "string" ? data.detail : detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw Object.assign(new Error(detail), { status: response.status });
  }
  if (options.raw) return response;
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return response.json();
  return response.text();
}

export async function download(path, body, fallbackName) {
  const response = await api(path, { method: "POST", body, raw: true });
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = match ? match[1] : fallbackName;
  link.click();
  URL.revokeObjectURL(link.href);
}
