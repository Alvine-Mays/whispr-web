/* Service Worker Whispr — cache versionné, stratégies, offline et push */

const CACHE_VERSION = 'v1.0.2';
const STATIC_CACHE = `whispr-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `whispr-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/index.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/public-page.html',
  '/dashboard.html',
  '/assets/css/styles.css',
  '/js/main.js',
  '/js/config.js',
  '/js/api.js',
  '/js/theme.js',
  '/js/i18n.js',
  '/js/notify.js',
  '/js/share-image.js',
  '/js/stats.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/maskable-192.png',
  '/assets/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API dashboard → Network First (quel que soit l’hôte)
  if (url.pathname.startsWith('/api/dashboard') || url.href.includes('/api/dashboard')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Assets (même origine) → Stale While Revalidate
  if (url.origin === self.location.origin && STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Navigation fallback offline (même origine)
  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(OFFLINE_URL);
        return cached || Response.error();
      }
    })());
    return;
  }
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((resp) => { cache.put(request, resp.clone()); return resp; }).catch(() => null);
  return cached || fetchPromise || Response.error();
}

// Push: afficher notification (title/body) et focus dashboard au clic
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch(e) { data = { title: 'Whispr', body: event.data?.text() || '' }; }
  const title = data.title || 'Whispr';
  const body = data.body || 'Nouveau message';
  const options = { body, icon: '/assets/icons/icon-192.png', badge: '/assets/icons/icon-192.png', data: { url: '/dashboard.html' } };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard.html';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of allClients) {
      const c = client;
      if ('focus' in c) { c.focus(); }
      if ('navigate' in c) { c.navigate(url); }
      return;
    }
    self.clients.openWindow(url);
  })());
});
