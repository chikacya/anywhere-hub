const CACHE_NAME = "anywhere-hub-shell-v35";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260928-hub-updates5",
  "./app.js?v=20260928-hub-updates4",
  "./manifest.webmanifest?v=logo-original",
  "./report-worker.js",
  "./lib/arrs.mjs",
  "./lib/attribution.mjs",
  "./lib/bundle-names.mjs",
  "./lib/normalize.mjs",
  "./lib/parser.mjs",
  "./lib/zip.mjs",
  "./lib/mitm-updates.mjs?v=20260928-hub-updates3",
  "./icons/anywhere-hub-mark.svg?v=logo-original",
  "./icons/anywhere-hub-180.png?v=logo-original",
  "./icons/anywhere-hub-192.png?v=logo-original",
  "./icons/anywhere-hub-512.png?v=logo-original",
  "./icons/anywhere-hub-maskable-512.png?v=logo-original",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("anywhere-hub-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("t")) return;
  if (url.origin === self.location.origin) {
    if (event.request.mode === "navigate") {
      event.respondWith(fetch(event.request).then((response) => {
        if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())));
        return response;
      }).catch(() => caches.match(event.request)));
      return;
    }
    event.respondWith(caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())));
        return response;
      }).catch(() => cached);
      if (cached) event.waitUntil(network);
      return cached || network;
    }));
    return;
  }
  if (url.hostname === "raw.githubusercontent.com" || url.hostname === "api.github.com") {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())));
      return response;
    }).catch(() => caches.match(event.request)));
  }
});
