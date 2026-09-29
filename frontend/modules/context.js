import { api } from "./api.js";

export const state = {
  user: null,
  online: navigator.onLine,
  excavationId: sessionStorage.getItem("excavationId") || "",
  layerId: sessionStorage.getItem("layerId") || "",
  excavations: null,
};

let navigatorFn = (path) => {
  location.hash = path.startsWith("#") ? path : `#${path}`;
};

export function setNavigator(fn) {
  navigatorFn = fn;
}

export function navigate(path) {
  navigatorFn(path);
}

export function setExcavation(id) {
  state.excavationId = id ? String(id) : "";
  sessionStorage.setItem("excavationId", state.excavationId);
}

export function setLayer(id) {
  state.layerId = id ? String(id) : "";
  sessionStorage.setItem("layerId", state.layerId);
}

export function rank(user) {
  return { field_archaeologist: 1, camera_staff: 2, supervisor: 3 }[user?.role] || 0;
}

export function allow(level) {
  return rank(state.user) >= level;
}

export async function loadExcavations(force = false) {
  if (!state.excavations || force) state.excavations = await api("/api/excavations");
  return state.excavations;
}

export function invalidateExcavations() {
  state.excavations = null;
}
