// 记账本 Service Worker - 离线缓存
const CACHE_NAME = 'jizhang-v2';
const ASSETS = [
    './',
    './index.html',
    './app.css',
    './app.js',
    './manifest.json',
    './icons/icon.svg',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清除旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// 请求：网络优先，失败回退缓存
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
