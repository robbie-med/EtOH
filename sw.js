// EtOH Withdrawal Tool — Service Worker
// Network-first for the app shell, with a cache fallback so the tool remains
// usable offline at the bedside.

// Bump on every release. The activate handler drops all other caches, so an
// installed PWA picks up corrections instead of serving stale dosing forever.
const VERSION = 'etoh-wd-v4';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for the app shell, cache as fallback.
  //
  // This is deliberately NOT cache-first. Cache-first keeps an installed PWA on
  // whatever scoring thresholds and doses it first downloaded, which for a
  // clinical dosing tool means a published correction may never reach the
  // bedside. Correctness of doses outranks a few hundred ms of load time; the
  // cache fallback preserves full offline use when there is no network.
  event.respondWith(
    fetch(req).then((resp) => {
      if (!resp || !resp.ok) throw new Error('bad response');
      const copy = resp.clone();
      caches.open(VERSION).then((cache) => cache.put(req, copy));
      return resp;
    }).catch(() =>
      caches.match(req).then((cached) => cached || caches.match('./index.html'))
    )
  );
});
