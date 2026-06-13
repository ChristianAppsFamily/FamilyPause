const CACHE = "familypause-v2";
const STATIC = ["/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML shell + Vite bundles: network first so deploys are not stuck on stale cache
  if (
    event.request.mode === "navigate" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".html")
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match("/"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res.ok && STATIC.includes(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
    )
  );
});
