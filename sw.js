/* ============================================================
   SOVEREIGNTY PANEL · SW.JS (Service Worker) v1.1
   ============================================================
   v1.1 (14.10.2026):
     - РАЗДЕЛЕНЫ версии: STATIC_VERSION и TILES_VERSION.
       Раньше была одна CACHE_VERSION — при её смене сбрасывались
       и тайлы карты (6–10 МБ). Теперь стили/скрипты обновляются
       независимо, а тайлы живут своей жизнью.

   КОГДА ЧТО МЕНЯТЬ:

   ► Заливаешь новые стили, скрипты, HTML, шрифты, SVG:
       STATIC_VERSION = 'v1'  →  STATIC_VERSION = 'v2'

   ► Сервер перегенерировал карту (новые тайлы в data/tiles/):
       TILES_VERSION = 't1'   →  TILES_VERSION = 't2'

   Тайлы обычно обновляются на сервере раз в сутки/неделю — это
   твой выбор, менять редко. Стили — почти каждый раз.

   СТРАТЕГИИ:
     /data/tiles/*.png   — cache-first, ключ по TILES_VERSION
     /data/skins/*.png   — cache-first, ключ по TILES_VERSION
     *.css / *.js / шрифты / svg
                         — stale-while-revalidate
     *.json              — network-first с fallback
     всё остальное       — passthrough
   ============================================================ */

/* ↓↓↓ ЭТО ЕДИНСТВЕННЫЕ ДВЕ СТРОКИ, КОТОРЫЕ ТЫ МЕНЯЕШЬ ↓↓↓ */
var STATIC_VERSION = 'v1';
var TILES_VERSION  = 't1';
/* ↑↑↑ ЭТО ЕДИНСТВЕННЫЕ ДВЕ СТРОКИ, КОТОРЫЕ ТЫ МЕНЯЕШЬ ↑↑↑ */

var CACHE_STATIC = 'sovereignty-static-' + STATIC_VERSION;
var CACHE_TILES  = 'sovereignty-tiles-'  + TILES_VERSION;

/* ============================================================
   INSTALL
   ============================================================ */
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

/* ============================================================
   ACTIVATE — чистим устаревшие кэши
   ============================================================ */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                var keep = (key === CACHE_STATIC || key === CACHE_TILES);
                if (!keep) {
                    console.log('[SW] Удаляю устаревший кэш:', key);
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

    /* Тайлы карты — cache-first, ключ по TILES_VERSION */
    if (sameOrigin && url.pathname.indexOf('/data/tiles/') !== -1) {
        event.respondWith(cacheFirst(req, CACHE_TILES));
        return;
    }

    /* Скины игроков — cache-first, тоже по TILES_VERSION
       (они обновляются с той же частотой, что и карта) */
    if (sameOrigin && url.pathname.indexOf('/data/skins/') !== -1) {
        event.respondWith(cacheFirst(req, CACHE_TILES));
        return;
    }

    /* CSS / JS / шрифты / SVG — stale-while-revalidate */
    if (url.pathname.match(/\.(css|js|mjs|svg|woff2?|ttf|eot)$/i)) {
        event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
        return;
    }

    /* JSON — network-first с fallback */
    if (url.pathname.endsWith('.json')) {
        event.respondWith(networkFirst(req, CACHE_STATIC));
        return;
    }
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
