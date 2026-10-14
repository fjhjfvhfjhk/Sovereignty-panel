/* ============================================================
   SOVEREIGNTY PANEL · SW.JS (Service Worker) v1.0
   ============================================================
   Кэширует ресурсы панели в браузере. Работает через Cache API.

   СТРАТЕГИИ:
     /data/tiles/*.png   — cache-first, НАВСЕГДА (URL с ?v=)
     /data/skins/*.png   — cache-first
     *.css / *.js / *.woff2 / *.svg
                         — stale-while-revalidate
     *.json              — network-first, cache как fallback
     всё остальное       — passthrough

   ПРИ ОБНОВЛЕНИИ СТИЛЕЙ/СКРИПТОВ:
     Поменяй CACHE_VERSION ниже (v1 → v2).
     Это создаст новые имена кэшей, старые удалятся автоматически
     при активации нового SW.
   ============================================================ */

var CACHE_VERSION = 'v1';
var CACHE_STATIC = 'sovereignty-static-' + CACHE_VERSION;
var CACHE_TILES  = 'sovereignty-tiles-' + CACHE_VERSION;

/* ============================================================
   INSTALL — принимаем сразу, без предварительного кэширования
   ============================================================ */
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

/* ============================================================
   ACTIVATE — чистим устаревшие кэши, активируемся
   ============================================================ */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key !== CACHE_STATIC && key !== CACHE_TILES) {
                    console.log('[SW] Удаляю старый кэш:', key);
                    return caches.delete(key);
                }
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

/* ============================================================
   FETCH — маршрутизация
   ============================================================ */
self.addEventListener('fetch', function (event) {
    var req = event.request;

    if (req.method !== 'GET') return;

    var url;
    try { url = new URL(req.url); } catch (e) { return; }
    var sameOrigin = url.origin === self.location.origin;

    /* -- Тайлы карты: cache-first НАВСЕГДА -- */
    if (sameOrigin && url.pathname.indexOf('/data/tiles/') !== -1) {
        event.respondWith(cacheFirst(req, CACHE_TILES));
        return;
    }

    /* -- Скины игроков: cache-first -- */
    if (sameOrigin && url.pathname.indexOf('/data/skins/') !== -1) {
        event.respondWith(cacheFirst(req, CACHE_TILES));
        return;
    }

    /* -- CSS / JS / шрифты / SVG: stale-while-revalidate -- */
    if (url.pathname.match(/\.(css|js|mjs|svg|woff2?|ttf|eot)$/i)) {
        event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
        return;
    }

    /* -- JSON: network-first с fallback на кэш -- */
    if (url.pathname.endsWith('.json')) {
        event.respondWith(networkFirst(req, CACHE_STATIC));
        return;
    }

    /* Остальное — браузер обработает как обычно */
});

/* ============================================================
   Хелперы
   ============================================================ */

function cacheFirst(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (cached) {
            if (cached) return cached;
            return fetch(req).then(function (response) {
                if (response && response.ok) {
                    cache.put(req, response.clone()).catch(function () {});
                }
                return response;
            });
        });
    });
}

function staleWhileRevalidate(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (cached) {
            var network = fetch(req).then(function (response) {
                if (response && response.ok) {
                    cache.put(req, response.clone()).catch(function () {});
                }
                return response;
            }).catch(function (err) {
                if (cached) return cached;
                throw err;
            });
            return cached || network;
        });
    });
}

function networkFirst(req, cacheName) {
    return fetch(req).then(function (response) {
        if (response && response.ok) {
            var clone = response.clone();
            caches.open(cacheName).then(function (cache) {
                cache.put(req, clone).catch(function () {});
            });
        }
        return response;
    }).catch(function () {
        return caches.open(cacheName).then(function (cache) {
            return cache.match(req).then(function (cached) {
                if (cached) return cached;
                return new Response('{"error":"offline"}', {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            });
        });
    });
}
