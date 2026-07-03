const CACHE_VERSION = 'v158';
const CACHE_NAME = `kothabot-${CACHE_VERSION}`;

// Only cache truly static brand assets — everything else goes network-first
const STATIC_ASSETS = [
  '/kotha-logo.png',
  '/apple-icon.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'KothaBot', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'KothaBot', {
      body:  data.body  ?? '',
      icon:  data.icon  ?? '/kotha-logo.png',
      badge: data.badge ?? '/icons/badge-72.png',
      tag:   data.tag   ?? 'kothabot',
      data:  { url: data.url ?? '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Always network for: navigation, API, Next.js runtime chunks
  if (
    request.mode === 'navigate' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/')
  ) {
    return; // browser default — no SW interference
  }

  // Static brand assets — cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
