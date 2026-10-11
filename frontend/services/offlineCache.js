const PREFIX = "arch-read-cache:";
const MAX_AGE = 24 * 60 * 60 * 1000;
const LIMIT = 60;
export function cacheable(path) {
  return /^\/api\/(auth\/me|findings|excavations|layers|plan|dictionaries)(\?|\/\d+(?:\/layers|\/checks)?(?:\?|$)|$)/.test(path);
}
export function clearReadCache() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
}
function keyFor(token, path) { return PREFIX + token + ":" + path; }
export function cacheRead(token, path, data) {
  if (!token || !cacheable(path)) return;
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
    if (keys.length >= LIMIT) {
      keys.sort((a, b) => JSON.parse(localStorage.getItem(a)).at - JSON.parse(localStorage.getItem(b)).at);
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(keyFor(token, path), JSON.stringify({ at: Date.now(), data }));
  } catch { /* Quota limits must not prevent online work. */ }
}
export function cachedRead(token, path) {
  if (!token || !cacheable(path)) return undefined;
  try {
    const entry = JSON.parse(localStorage.getItem(keyFor(token, path)));
    if (!entry || Date.now() - entry.at > MAX_AGE) return undefined;
    return entry.data;
  } catch { return undefined; }
}
let disconnected = false;
export function isDisconnected() { return disconnected; }
export function connectionState(offline) {
  disconnected = offline;
  window.dispatchEvent(new CustomEvent("arch:connection", { detail: { offline } }));
}
