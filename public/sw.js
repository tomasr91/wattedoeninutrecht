/*
 * Service worker: app-schil uit de cache (snel openen, ook met slecht bereik),
 * activiteitendata altijd eerst van het netwerk zodat je de nieuwste update ziet.
 * Zonder netwerk valt de app terug op de laatst geladen data; de app toont dan
 * de datum van de laatste update, zodat oude informatie herkenbaar blijft.
 */
const CACHE = 'ufa-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isData = url.pathname.includes('/data/');
  if (isData || e.request.mode === 'navigate') {
    // Netwerk eerst
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r ?? caches.match('./index.html'))),
    );
    return;
  }
  // Statische bestanden (met hash in de naam): cache eerst
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ??
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        }),
    ),
  );
});
