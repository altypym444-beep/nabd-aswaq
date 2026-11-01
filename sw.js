/* nabd-aswaq service worker v3-20261102 */
const CACHE = 'nabd-aswaq-v3-20261102';
const PRECACHE = ['./manifest.webmanifest', './icon-192.png', './icon-180.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isShell(url) {
  const p = url.pathname;
  if (p.endsWith('/') || p.endsWith('/index.html') || p.endsWith('.html')) return true;
  if (p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.webmanifest')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDN/WS/TV/etc alone

  // Network-first for HTML/JS/CSS so updates show immediately
  if (isShell(url)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
          return caches.match('./index.html');
        }
        throw err;
      }
    })());
    return;
  }

  // Cache-first for icons / bake snapshots
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      throw err;
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
