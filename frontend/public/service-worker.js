/* ─── IDA ATS Service Worker ─────────────────────────────────────────────────
   Розміщення: /public/service-worker.js
   Стратегія: Cache-first для статики, Network-first для API
   ─────────────────────────────────────────────────────────────────────────── */

const CACHE_NAME = 'ida-ats-v1';
const STATIC_CACHE = 'ida-static-v1';
const API_CACHE = 'ida-api-v1';

// Ресурси що кешуються при інсталяції (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
];

// Хости API — не кешуємо агресивно
const API_HOSTS = [
  'ida-ats-production.up.railway.app',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => {
        // Не блокуємо install якщо якийсь ресурс недоступний
        console.warn('[SW] Precache часткова помилка:', err);
      })
  );
});

// ─── Activate — чистимо старі кеші ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== API_CACHE)
          .map(key => {
            console.log('[SW] Видаляємо старий кеш:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ігноруємо не-GET та chrome-extension запити
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API запити — Network-first з fallback на кеш
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Навігаційні запити (HTML) — повертаємо /index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(cached => cached || fetch(request))
    );
    return;
  }

  // Статика (JS, CSS, images) — Cache-first
  event.respondWith(cacheFirstStrategy(request));
});

// ─── Стратегії ────────────────────────────────────────────────────────────────

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Офлайн — нічого не повернути
    return new Response('Офлайн', { status: 503 });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Мережа недоступна — пробуємо кеш
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Офлайн. Дані недоступні.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function isApiRequest(url) {
  return (
    API_HOSTS.some(host => url.hostname.includes(host)) ||
    url.pathname.startsWith('/api/')
  );
}

// ─── Push-сповіщення (майбутнє) ───────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'IDA ATS', {
      body: data.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});