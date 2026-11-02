/* nabd-aswaq SW v4 — network-only pass-through; never cache HTML/JS/CSS */
const CACHE = 'nabd-passthrough-v4';
self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Always hit network with no-store for navigations and shell assets
  event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
});
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'UNREGISTER') {
    self.registration.unregister();
  }
});
