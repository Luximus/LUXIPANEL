/* LuxiPanel Service Worker */
const SW_VERSION = "luxipanel-v35-20261001-internal-modules";
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const SHELL_CACHE = `${SW_VERSION}-shell`;

const SHELL_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon-180.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== RUNTIME_CACHE && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = {}; }
  const title = typeof payload.title === "string" ? payload.title : "Notificación de LUXIPANEL";
  const body = typeof payload.body === "string" ? payload.body : "";
  let proposed = null;
  try { proposed = typeof payload.url === "string" ? new URL(payload.url, self.location.origin) : null; } catch { proposed = null; }
  const url = proposed?.origin === self.location.origin && proposed.pathname.startsWith("/panel") ? proposed.href : "/panel/server-alerts";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/icons/icon-192.png", data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/panel/server-alerts";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url === url);
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});

function shouldBypass(url) {
  if (url.origin !== self.location.origin) return true;
  const p = url.pathname;
  if (p.startsWith("/api/")) return true;
  if (p === "/sw.js" || p === "/manifest.webmanifest") return true;
  if (p.startsWith("/panel/manifest.webmanifest")) return true;
  if (p.endsWith(".webmanifest")) return true;
  // Never cache shell HTML for panel pages whose JS reference rotates with
  // each deploy. A stale HTML response would lock users into an old bundle
  // that no longer matches the live API.
  if (p === "/" || p === "/panel" || p === "/panel/") return true;
  if (p === "/monitor" || p === "/monitor/" || p === "/panel/monitor" || p === "/panel/monitor/") return true;
  return false;
}

function isStaticAsset(url) {
  const p = url.pathname;
  return (
    p.startsWith("/_luxi/") ||
    p.startsWith("/scripts/") ||
    p.startsWith("/fonts/") ||
    p.startsWith("/icons/") ||
    /\.(css|js|mjs|map|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)$/i.test(p)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (shouldBypass(url)) return;

  // Navigation: network-first with offline fallback to cached shell
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Versioned i18n namespace files (/i18n/<hash>/<locale>/<ns>.json) are
  // content-addressed and immutable → cache-first: after the first load they
  // never touch the network (persists across sessions and works offline). A
  // new deploy changes the hash → a fresh URL → a fresh cache entry. The
  // manifest (/i18n/manifest.json) is the one mutable pointer, so it is
  // explicitly excluded and left to the network (its 60s max-age handles it).
  if (
    url.pathname.startsWith("/i18n/") &&
    url.pathname !== "/i18n/manifest.json" &&
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Extracted per-module scripts (/scripts/**): unlike /_luxi/ these keep a
  // STABLE filename across deploys and rely on a hand-bumped `?v=` for freshness.
  // stale-while-revalidate served the previous bundle to every client with a warm
  // entry, and when that stale entry is an entry point it drags its whole import
  // chain along: the old index-script1.js keeps importing the old
  // `panel-files-monaco.js?v=27`, itself still warm, so a deploy could land in
  // dist and never reach the browser (that is how the Monaco `.astro` language
  // fix stayed invisible). Network-first leaves CacheStorage as an offline
  // fallback; the HTTP cache has a short lifetime for repeat module openings.
  if (url.pathname.startsWith("/scripts/")) {
    event.respondWith(networkFirstAsset(req));
    return;
  }

  // Static assets: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => undefined);
  return fresh;
}

async function networkFirst(req) {
  // Navigations only (see fetch handler). We intentionally do NOT persist the
  // response: panel pages are authenticated SSR HTML that embeds per-session
  // data (e.g. the bridge-session id) and carries `Cache-Control: no-store`.
  // Caching them leaked that HTML to disk and served it after logout (it only
  // cleared on a SW_VERSION bump). Network-only with an offline fallback.
  try {
    return await fetch(req);
  } catch {
    const shell = await caches.match("/");
    if (shell) return shell;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>LuxiPanel offline</title><body style=\"font-family:system-ui;background:#0a0a0a;color:#fff;display:grid;place-items:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h1>LuxiPanel</h1><p>Sin conexión con el servidor.</p></div>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/** Network-first WITH a cached fallback, for assets whose filename is stable and
 *  whose freshness depends on a hand-bumped `?v=` (see the /scripts/ branch). The
 *  cache is refreshed on every successful hit so offline still works. */
async function networkFirstAsset(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => undefined);
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response("", { status: 504, statusText: "Offline and not cached" });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

/* ── Push notifications (preserved from previous SW) ───────────────────── */
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = { title: "LuxiPanel", body: e.data.text() };
  }
  const title = payload.title ?? "LuxiPanel";
  const options = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/icons/icon-192.png",
    badge: payload.badge ?? "/icons/icon-192.png",
    data: payload.data ?? {},
    tag: payload.tag ?? "luxipanel-alert",
    renotify: payload.renotify ?? true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/panel/monitor";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
