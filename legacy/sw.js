/* ── StainBoost service worker ──
 * HTML/CSS/JS: network-first (styles and markup always deploy together,
 * cache fallback when offline)
 * Images/fonts: stale-while-revalidate
 * /api/ and cross-origin requests are never touched.
 */
const CACHE = 'sb-v2';
const PRECACHE = [
  '/',
  '/shared.css',
  '/main.js',
  '/favicon.ico',
  '/favicon-48.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/avatar.jpeg',
  '/og-image.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // best-effort precache: a single missing file must not break install
      return Promise.allSettled(PRECACHE.map(function (url) { return cache.add(url); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) return;

  // navigations + CSS/JS: network-first so content and styles stay in sync
  if (req.mode === 'navigate' || /\.(css|js)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/');
        });
      })
    );
    return;
  }

  // images and fonts: stale-while-revalidate
  if (/\.(png|jpe?g|webp|svg|ico|woff2?)$/.test(url.pathname) || url.pathname === '/site.webmanifest') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        const refresh = fetch(req).then(function (res) {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || refresh;
      })
    );
  }
});
