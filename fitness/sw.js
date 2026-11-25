/* 離線快取：安裝時把所有檔案存起來；之後先回快取，同時在背景抓新版，下次開啟就會更新。 */
const CACHE = 'bandfit-v12';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'data.js',
  'device.js',
  'charts.js',
  'figures.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bandfit-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  /* 開合跳欠款（jj.json）要最新的：先抓網路，抓不到才用快取 */
  const u = new URL(req.url);
  if (u.pathname.endsWith('/jj.json')) {
    const key = u.origin + u.pathname;   // 去掉 ?t=…，快取裡只留一份
    e.respondWith(caches.open(CACHE).then(cache => fetch(req).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => cache.match(key).then(r => r || new Response('', { status: 504, statusText: 'offline' })))));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      const res = await fresh;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('', { status: 504, statusText: 'offline' });
    })
  );
});
