// ==========================================
// DH Field EMR — Service Worker (Offline-First)
// ==========================================
// Bump cache version on every release so existing PWAs pick up fixes.
const CACHE_NAME = 'dh-emr-v8-2.2.1-role-fix-build20260806134411';
const BASE = self.registration.scope;
// Prod (/dh-field-emr/pwa/) and staging (/dh-field-emr/pwa-next/) share one
// origin. Namespace the cache by the SW's registration scope so activating one
// deployment never wipes the other deployment's offline cache.
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE_KEY = CACHE_NAME + '::' + SCOPE;
const ASSET_NAMES = [
  "",
  "admin.js",
  "analytics.js",
  "app.js",
  "backup.js",
  "config.js",
  "csv-export.js",
  "demo-mode.js",
  "dx-presets.js",
  "encounter.js",
  "form-builder.js",
  "form-generator.js",
  "form-nav.js",
  "form-schema.js",
  "formulary.js",
  "helpers.js",
  "icd10.js",
  "icon-192.png",
  "icon-512.png",
  "icon.svg",
  "idb-storage.js",
  "index.html",
  "labs.js",
  "manifest.json",
  "med-builder.js",
  "native-storage.js",
  "platform.js",
  "pwa-responsive.css",
  "pwa-sync.js",
  "pwa-touch.js",
  "records.js",
  "rx-presets.js",
  "scheduling.js",
  "setup-wizard.js",
  "state.js",
  "storage-health.js",
  "styles.css",
  "sync-ui.js"
];
const ASSETS = ASSET_NAMES.map(n => BASE + n);

// Install — cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_KEY).then((cache) => {
      console.log('[SW] Caching all assets');
      // Precache with cache:'reload' so assets bypass the HTTP cache. GitHub
      // Pages max-age can otherwise pin mixed-version assets into a new SW.
      return cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })));
    })
    // NOTE: no self.skipWaiting() here on purpose. Auto-activation fires
    // controllerchange before the user taps "Update now", which makes the
    // gated reload hang. skipWaiting() only runs from the SKIP_WAITING message.
  );
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const suffix = '::' + SCOPE;
      return Promise.all(
        // Only delete stale caches belonging to THIS deployment's scope.
        // Never touch the other deployment's caches (different SCOPE suffix).
        keys.filter((key) => key.endsWith(suffix) && key !== CACHE_KEY)
            .map((key) => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// Fetch — cache-first, network fallback, background update
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // Never handle cross-origin requests (e.g. Supabase REST). Caching them
  // causes stale pulls, a false "connected" status while offline, and PHI
  // landing in Cache Storage. Let the network handle them directly.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_KEY).then((cache) => cache.match(event.request)).then((cachedResponse) => {
      // Return cached version immediately
      if (cachedResponse) {
        // Background update: fetch fresh copy and update cache
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_KEY).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {
            // Network unavailable — that's fine, we served from cache
          })
        );
        return cachedResponse;
      }

      // Not in cache — try network
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses for future offline use
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_KEY).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Both cache and network failed — return offline fallback for HTML.
        // Use the scope-prefixed URL so this works on GitHub Pages
        // (e.g. /dh-emr-app/index.html), and guard against a null accept header.
        const accept = event.request.headers.get('accept') || '';
        if (accept.includes('text/html')) {
          return caches.open(CACHE_KEY).then((cache) => cache.match(BASE + 'index.html'));
        }
      });
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
