const CACHE = "glc27-v23-shell-v1";
const BASE = new URL("./", self.registration.scope).pathname;
const NAVIGATION_TIMEOUT_MS = 3500;
const LOCAL_PAGES = [
  "",
  "404.html",
  "programme",
  "programme.html",
  "matches",
  "matches.html",
  "match",
  "match.html",
  "scorer",
  "scorer.html",
  "settings",
  "settings.html",
  "about",
  "about.html",
  "app",
  "app.html",
  "manifest.webmanifest",
  "assets/pwa-192.png",
  "assets/pwa-512.png",
  "assets/glc27-favicon.png"
];
const RUNTIME_ORIGINS = new Set([
  "https://www.gstatic.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com"
]);

function absolute(path) {
  return new URL(path, self.registration.scope).href;
}

function localRequest(path) {
  return new Request(absolute(path), { cache: "reload" });
}

async function cacheLocalPageAssets(cache, pageUrl) {
  try {
    const response = await fetch(localRequest(pageUrl));
    if (!response.ok && response.status !== 404) return;
    const pageResponse = response.clone();
    await cache.put(absolute(pageUrl), pageResponse);
    const html = await response.text();
    const references = new Set();
    const patterns = [
      /<script[^>]+src=["']([^"']+)["']/gi,
      /<link[^>]+href=["']([^"']+)["']/gi
    ];
    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        const raw = match[1];
        const resolved = new URL(raw, absolute(pageUrl));
        if (resolved.origin === self.location.origin && resolved.pathname.startsWith(BASE)) {
          references.add(resolved.href);
        }
      }
    }
    await Promise.all([...references].map(async (url) => {
      try {
        const asset = await fetch(new Request(url, { cache: "reload" }));
        if (asset.ok) await cache.put(url, asset.clone());
      } catch {}
    }));
  } catch {}
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const page of LOCAL_PAGES) {
      await cacheLocalPageAssets(cache, page);
    }

    // GitHub Pages uses 404.html for the extensionless SPA routes. Store a
    // successful copy of that app shell under each clean route so those routes
    // remain navigable when the network disappears.
    try {
      const fallback = await fetch(localRequest("404.html"));
      if (fallback.ok) {
        const body = await fallback.text();
        const headers = new Headers(fallback.headers);
        headers.set("Content-Type", "text/html; charset=utf-8");
        for (const route of ["programme", "matches", "match", "scorer", "settings", "about", "app"]) {
          await cache.put(absolute(route), new Response(body, { status: 200, headers }));
        }
      }
    } catch {}

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkWithTimeout(request, timeout = NAVIGATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || await network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const runtimeOrigin = RUNTIME_ORIGINS.has(url.origin);

  if (!sameOrigin && !runtimeOrigin) return;

  if (request.mode === "navigate" && sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cachedExact = await cache.match(request);
      const cachedPath = await cache.match(new Request(url.origin + url.pathname));
      try {
        const response = await networkWithTimeout(request);
        if (response.ok) {
          void cache.put(request, response.clone());
          return response;
        }
        return cachedExact || cachedPath || await cache.match(absolute("404.html"));
      } catch {
        return cachedExact || cachedPath || await cache.match(absolute("404.html"));
      }
    })());
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
  if (event.data?.type === "LIVE_SCORE") {
    const d = event.data;
    event.waitUntil(self.registration.showNotification(d.title || "GLC27 live score", {
      body: d.body || "Live score update",
      icon: d.icon || absolute("assets/glc27-favicon.png"),
      badge: d.icon || absolute("assets/glc27-favicon.png"),
      tag: `glc-live-${d.matchId || "score"}`,
      renotify: true,
      requireInteraction: true,
      data: { matchId: d.matchId || "" }
    }));
  }
  if (event.data?.type === "LIVE_SCORE_CLEAR") {
    event.waitUntil(self.registration.getNotifications({ tag: `glc-live-${event.data.matchId || "score"}` }).then((list) => list.forEach((n) => n.close())));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const matchId = event.notification.data?.matchId;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const target = matchId ? absolute(`match?match=${encodeURIComponent(matchId)}`) : self.registration.scope;
    const existing = list.find((client) => "focus" in client);
    return existing ? existing.focus().then(() => existing.navigate?.(target)) : clients.openWindow(target);
  }));
});
