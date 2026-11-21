const CACHE_PREFIX = "meethaq-shell-";
const PRECACHE = /* build:precache */ { version: "dev", urls: [] };
const CACHE_NAME = CACHE_PREFIX + PRECACHE.version;
const offlineAssets = new Set(PRECACHE.urls);
const PRINT_CACHE = "meethaq-mushaf-print-be0091b2";
const printPage = /^\/data\/quran\/print-be0091b2\/\d{3}\.webp$/;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    PRECACHE.urls.map(url => new Request(url, { cache: "reload" })),
  )));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin
    || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match("/")) ?? Response.error();
    }));
    return;
  }

  // Let the origin handle byte ranges for browsers that request partial audio.
  if (request.headers.has("Range")) return;
  if (offlineAssets.has(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache =>
      (await cache.match(request)) ?? fetch(request),
    ));
  } else if (printPage.test(url.pathname)) {
    event.respondWith(caches.open(PRINT_CACHE).then(async cache =>
      (await cache.match(url.pathname)) ?? fetch(request),
    ));
  }
});

self.addEventListener("push", event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (typeof payload?.title !== "string") return;
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, tag: "meethaq-" + payload.key, icon: "/brand-512.png",
    silent: payload.silent === true, data: { href: payload.href },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    let destination = new URL("/", self.location.origin);
    const path = event.notification.data?.href;
    if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
      const candidate = new URL(path, self.location.origin);
      if (candidate.origin === self.location.origin) destination = candidate;
    }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === destination.href);
    if (existing) return existing.focus();
    const client = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (client) {
      const next = await client.navigate(destination.href);
      if (next) return next.focus();
    }
    return self.clients.openWindow(destination.href);
  })());
});
