const CACHE = "excavations-shell-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith("excavations-shell-") && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (!(req.mode === "navigate" || /\.(js|css)$/.test(url.pathname))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(req);
      if (response.ok) { await cache.put(req, response.clone()); if (req.mode === "navigate") await cache.put("/", response.clone()); }
      return response;
    } catch {
      return await cache.match(req) || (req.mode === "navigate" ? await cache.match("/") : null) || new Response("Нет связи", { status: 503 });
    }
  })());
});
