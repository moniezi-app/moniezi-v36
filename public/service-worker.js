/* MONIEZI PWA Service Worker
   - Fully bundled app - no CDN dependencies
   - Caches all assets for true offline support on all devices
*/

// Bump this on every deploy
// v15.1.4: restore safe precache so iOS A2HS can launch offline on FIRST open.
// The previous "no precache" change prevented the app shell from being available
// when offline at cold start.
const CACHE_VERSION = "moniezi-pro-finance-v36-0-0-license-connected-2026-07-22-1";
const CACHE_NAME = `moniezi-cache-${CACHE_VERSION}`;

// Resolve an asset relative to the service worker scope
const toScopeUrl = (path) => new URL(path, self.registration.scope).toString();

// Core assets to pre-cache
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./favicon.ico",
  "./favicon-32.png",
].map(toScopeUrl);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Offline-first requires the app shell to be available from cache.
      // We precache core assets, but we NEVER let a precache failure block install.
      // (If the device is offline during install/update, caching will fail — but
      // the SW should still install, and the app will work offline after the user
      // opens it once while online.)
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
      } catch (e) {
        // Swallow errors to avoid breaking install on flaky/offline networks.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up ALL old moniezi caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => 
          key.startsWith("moniezi-cache-") && key !== CACHE_NAME 
            ? caches.delete(key) 
            : null
        )
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation requests: CACHE-FIRST (offline-first)
  // Why: iOS can show an intrusive "Turn Off Airplane Mode" prompt if we try network-first
  // while the device is offline/airplane mode. MONIEZI should treat offline as normal.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        // Prefer cached app shell immediately.
        const cachedIndex = await cache.match(toScopeUrl("./index.html"));
        if (cachedIndex) return cachedIndex;

        // Fallback: try network only if we don't have the shell cached yet.
        try {
          const fresh = await fetch(req, { cache: "force-cache" });
          if (fresh && fresh.ok) {
            cache.put(toScopeUrl("./index.html"), fresh.clone());
          }
          return fresh;
        } catch (e) {
          const cachedRoot = await cache.match(toScopeUrl("./"));
          return cachedRoot || Response.error();
        }
      })()
    );
    return;
  }

  // All other assets: cache-first, then network
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const res = await fetch(req, { cache: "force-cache" });
        if (res && res.ok) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })()
  );
});
