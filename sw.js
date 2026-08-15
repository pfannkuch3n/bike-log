const CACHE_VERSION = 'v7';
const CACHE_NAME = `bike-log-${CACHE_VERSION}`;

const APP_SHELL = [
  '.',
  'index.html',
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('bike-log-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const istAppShell = (request) => {
  if (request.mode === 'navigate') return true;
  const pfad = new URL(request.url).pathname;
  return pfad.endsWith('/') || pfad.endsWith('/index.html');
};

const inCacheLegen = (request, response) => {
  if (!response || response.status !== 200 || response.type !== 'basic') return response;
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  return response;
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // index.html network-first: sonst braucht jede Aenderung einen CACHE_VERSION-Bump,
  // damit sie ueberhaupt auf dem Geraet ankommt. Offline faellt es auf den Cache zurueck.
  if (istAppShell(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => inCacheLegen(event.request, response))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('index.html')))
    );
    return;
  }

  // Alles andere (Icons, Manifest) aendert sich selten – cache-first bleibt schneller.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => inCacheLegen(event.request, response));
    })
  );
});
