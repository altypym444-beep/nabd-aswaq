const CACHE='live-dash-shell-v2';
const ASSETS=['./','./index.html','./app.js','./manifest.webmanifest','./icon-192.png','./icon-180.png','./icon-512.png'];
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',(e)=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',(e)=>{
  const u=new URL(e.request.url);
  if(u.pathname.includes('bake-') || u.hostname.includes('binance') || u.hostname.includes('coingecko') || u.hostname.includes('er-api') || u.hostname.includes('rss2json') || u.hostname.includes('google') || u.hostname.includes('bloomberg') || u.hostname.includes('carto') || u.hostname.includes('leaflet') || u.hostname.includes('jsdelivr') || u.hostname.includes('unpkg') || u.hostname.includes('tradingview')) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
