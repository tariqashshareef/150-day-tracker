// Offline cache. The app and its files try the network first (so an update shows up the next time you open it)
// and fall back to the cache when you're offline. The fonts never change, so they are served from the cache.
const CACHE = "d150-1";
const FILES = [
  "./", "index.html", "style.css", "app.js", "strokes.js", "manifest.webmanifest",
  "icon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "fonts/ShipporiMincho-Medium.woff2", "fonts/ShipporiMincho-SemiBold.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one by one, so a single failed file can't stop the whole install
    for (const file of FILES) {
      try { await cache.add(new Request(file, { cache: "reload" })); } catch (e) { /* fetched on first use instead */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("d150-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  const isFont = request.url.includes("/fonts/");
  event.respondWith((async () => {
    if (isFont) {
      const hit = await caches.match(request);
      if (hit) return hit;
    }
    // a weak connection shouldn't hold the app hostage: after a few seconds, use what is saved
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    try {
      const response = await fetch(request, { cache: "no-cache", signal: ctrl.signal });
      clearTimeout(timer);
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch (e) {
      clearTimeout(timer);
      const saved = await caches.match(request, { ignoreSearch: true });
      if (saved) return saved;
      if (request.mode === "navigate") return (await caches.match("index.html")) || (await caches.match("./"));
      throw e;
    }
  })());
});
