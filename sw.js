/* sw.js — 指數 & 行旅 Service Worker
 * 靜態資源：cache-first（版本號控制）
 * /api/news：network-first（新聞要新）
 * gate.html：永不快取（network-only），避免登入狀態被鎖死
 */
const CACHE = 'bk-travel-v1';
const STATIC_ASSETS = [
  './',
  'index.html',
  'about.html',
  'tools.html',
  'news.html',
  'etfrun.html',
  'bkfly.html',
  'health.html',
  'music.html',
  'holdings.html',
  'goals.html',
  'finance.html',
  'article.html',
  'shared.css',
  'shared.js',
  'miles-pro.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // gate.html：永遠走網路，不快取
  if (url.pathname.endsWith('/gate.html') || url.pathname === '/gate.html') {
    event.respondWith(fetch(event.request));
    return;
  }

  // /api/news：network-first，失敗才用快取
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // /news/*.json（GitHub Actions 每小時更新）：永遠走網路，不快取
  if (url.pathname.startsWith('/news/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 其他靜態資源：cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      });
    })
  );
});
