import { ApiError, mockRequest, resetMock } from "./mockStore.js";

import { cacheRead, cachedRead, clearReadCache, connectionState } from "./offlineCache.js";

const MODE_KEY = "arch_api_mode";
const TOKEN_KEY = "arch_token";

export { ApiError, resetMock };

export function getMode() {
  return localStorage.getItem(MODE_KEY) || "live";
}

export function setMode(mode) {
  if (mode) localStorage.setItem(MODE_KEY, mode);
  else localStorage.removeItem(MODE_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (!token || token !== getToken()) clearReadCache();
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function detectMode() {
  // Demo is an explicit choice; network errors must never create a second dataset.
  const mode = localStorage.getItem(MODE_KEY) === "mock" ? "mock" : "live";
  localStorage.setItem(MODE_KEY, mode);
  return mode;
}

async function live(path, options) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  let body;
  if (options.formData) body = options.formData;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  let response;
  try {
    response = await fetch(path, { method: options.method || "GET", headers, body });
  } catch {
    connectionState(true);
    if (!options.method || options.method === "GET") {
      const cached = cachedRead(token, path);
      if (cached !== undefined) return cached;
    }
    throw new ApiError(0, "Нет связи с сервером. Данные не отправлены или ответ не получен. Повторите сохранение после восстановления связи.");
  }
  connectionState(false);
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) clearReadCache();
    let detail = "Ошибка запроса";
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => ({}));
      detail = data.detail || detail;
    }
    throw new ApiError(response.status, detail);
  }
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (!options.method || options.method === "GET") cacheRead(token, path, data);
    else if (!path.startsWith("/api/auth/")) clearReadCache();
    return data;
  }
  if (contentType.includes("text/html")) return response.text();
  return response.blob();
}

export async function api(path, options = {}) {
  if (getMode() === "live") return live(path, options);
  return mockRequest(path, options);
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function saveText(content, filename, mime) {
  saveBlob(new Blob([content], { type: mime || "text/plain;charset=utf-8" }), filename);
}

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const authApi = {
  login: (body) => api("/api/auth/login", { method: "POST", body }),
  register: (body) => api("/api/auth/register", { method: "POST", body }),
  me: () => api("/api/auth/me"),
  logout: () => api("/api/auth/logout", { method: "POST" }),
};

export const usersApi = {
  list: () => api("/api/users"),
  create: (body) => api(`/api/users?role=${encodeURIComponent(body.role || "field_archaeologist")}`, { method: "POST", body }),
  update: (id, body) => api(`/api/users/${id}`, { method: "PUT", body }),
};

export const excavationsApi = {
  list: (status) => api(`/api/excavations${queryString({ status })}`),
  get: (id) => api(`/api/excavations/${id}`),
  layers: (id) => api(`/api/excavations/${id}/layers`),
  checks: (id) => api(`/api/excavations/${id}/checks`),
  create: (body) => api("/api/excavations", { method: "POST", body }),
  update: (id, body) => api(`/api/excavations/${id}`, { method: "PUT", body }),
  archive: (id) => api(`/api/excavations/${id}/archive`, { method: "POST" }),
  restore: (id) => api(`/api/excavations/${id}/restore`, { method: "POST" }),
};

export const layersApi = {
  list: (excavationId) => api(`/api/layers${queryString({ excavation_id: excavationId })}`),
  create: (body) => api("/api/layers", { method: "POST", body }),
  update: (id, body) => api(`/api/layers/${id}`, { method: "PUT", body }),
  remove: (id) => api(`/api/layers/${id}`, { method: "DELETE" }),
};

export const findingsApi = {
  list: (params) => api(`/api/findings${queryString(params)}`),
  get: (id) => api(`/api/findings/${id}`),
  create: (body, idempotencyKey) => api("/api/findings", { method: "POST", body, idempotencyKey }),
  update: (id, body) => api(`/api/findings/${id}`, { method: "PUT", body }),
  remove: (id) => api(`/api/findings/${id}`, { method: "DELETE" }),
  coordinates: (id, body) => api(`/api/findings/${id}/coordinates`, { method: "PUT", body }),
  dimensions: (id, body) => api(`/api/findings/${id}/dimensions`, { method: "PUT", body }),
  measure: (id, body) => api(`/api/findings/${id}/measure`, { method: "POST", body }),
};

export const photosApi = {
  list: (params) => api(`/api/photos${queryString(params)}`),
  upload: async (fields, file) => {
    if (getMode() === "live") {
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") formData.append(key, value);
      });
      formData.append("file", file);
      return api("/api/photos", { method: "POST", formData });
    }
    return api("/api/photos", { method: "POST", body: { ...fields, original_name: file?.name || "photo.png" } });
  },
  detectScale: (id) => api(`/api/photos/${id}/detect-scale`, { method: "POST" }),
  analyze: (id, scaleMm = 100) => api(`/api/photos/${id}/analyze?scale_mm=${encodeURIComponent(scaleMm)}`, { method: "POST" }),
  remove: (id) => api(`/api/photos/${id}`, { method: "DELETE" }),
};

export async function authorizedBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { headers });
  if (!response.ok) throw new ApiError(response.status, "Не удалось открыть файл");
  return URL.createObjectURL(await response.blob());
}

export const gnssApi = {
  list: (excavationId) => api(`/api/gnss${queryString({ excavation_id: excavationId })}`),
  preview: async (excavationId, file) => {
    const text = await file.text();
    if (getMode() === "live") {
      const formData = new FormData();
      formData.append("excavation_id", excavationId);
      formData.append("file", file);
      return api("/api/gnss/preview", { method: "POST", formData });
    }
    return api(`/api/gnss/preview?excavation_id=${excavationId}`, { method: "POST", text });
  },
  import: (body) => api("/api/gnss/import", { method: "POST", body }),
  remove: (id) => api(`/api/gnss/${id}`, { method: "DELETE" }),
};

export const planApi = {
  get: (params) => api(`/api/plan${queryString(params)}`),
};

export const reportsApi = {
  preview: (body) => api("/api/reports/findings", { method: "POST", body }),
  list: () => api("/api/reports"),
  confirm: (id) => api(`/api/reports/${id}/confirm`, { method: "POST" }),
  templates: () => api("/api/reports/templates"),
  saveTemplate: (body) => api("/api/reports/templates", { method: "POST", body }),
  removeTemplate: (id) => api(`/api/reports/templates/${id}`, { method: "DELETE" }),
  async exportFile(body) {
    if (getMode() === "live") {
      const token = getToken();
      const response = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ApiError(response.status, data.detail || "Не удалось выгрузить опись");
      }
      const blob = await response.blob();
      const match = (response.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/);
      saveBlob(blob, match?.[1] || (body.format === "pdf" ? "opis.pdf" : "opis.xlsx"));
      return response.headers.get("X-Report-Id");
    }
    const data = await api("/api/reports/export", { method: "POST", body });
    if (body.format === "pdf") return data;
    saveText(data.content, data.filename, data.mime);
    return data.report_id;
  },
  async print(body) {
    const popup = window.open("", "_blank");
    if (!popup) throw new ApiError(0, "Браузер заблокировал окно печати");
    let html;
    try { html = await api("/api/reports/print", { method: "POST", body }); }
    catch (error) { popup.close(); throw error; }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
    return html;
  },
};

export const dictionariesApi = {
  list: () => api("/api/dictionaries"),
  addMaterial: (body) => api("/api/dictionaries/materials", { method: "POST", body }),
  updateMaterial: (id, body) => api(`/api/dictionaries/materials/${id}`, { method: "PUT", body }),
  updateNamed: (kind, id, body) => api(`/api/dictionaries/${kind}/${id}`, { method: "PUT", body }),
};

export const auditApi = {
  list: () => api("/api/audit"),
};

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
