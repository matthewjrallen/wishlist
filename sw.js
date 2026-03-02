// ─── Wishlist Service Worker ─────────────────────────────────────────────────
// Cache-first for assets, network-first for Firebase API calls

const CACHE_NAME   = 'wishlist-v1';
const STATIC_CACHE = 'wishlist-static-v1';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Firebase/API requests (always network)
  if (request.method !== 'GET') return;
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    // Network-first, fall back to cache for CDN assets
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache CDN fonts/scripts
          if (
            url.hostname.includes('fonts.gstatic.com') ||
            url.hostname.includes('cdn.tailwindcss.com')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for app shell
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(STATIC_CACHE).then(c => c.put(request, clone));
        return response;
      });
    })
  );
});

// ─── Background sync placeholder ─────────────────────────────────────────────
self.addEventListener('sync', event => {
  // Future: queue failed writes and retry here
  console.log('[SW] Sync event:', event.tag);
});

// ─── Push notifications placeholder ──────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Wishlist', body: 'Update!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
    })
  );
});
