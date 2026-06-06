// Service worker — cache-first, tahan terhadap file yang gagal di-fetch
const CACHE = 'gerakan-janin-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './offline.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache per-file: kalau satu gagal, sisanya tetap tersimpan (tidak menggagalkan install)
    await Promise.all(ASSETS.map(async (url) => {
      try { await c.add(new Request(url, { cache: 'reload' })); }
      catch (err) { /* lewati file yang gagal, jangan batalkan install */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Navigasi (buka app dari ikon / refresh) -> sajikan index.html dari cache lebih dulu
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cachedIndex = await cache.match('./index.html');
      if (cachedIndex) return cachedIndex;
      try {
        const net = await fetch(req);
        return net;
      } catch (err) {
        const off = await cache.match('./offline.html');
        return off || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // Aset lain: cache-first
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        const c = await caches.open(CACHE);
        c.put(req, copy);
      }
      return res;
    } catch (err) {
      return cached || new Response('', { status: 504 });
    }
  })());
});
