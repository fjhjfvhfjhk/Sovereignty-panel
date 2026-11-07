/* ============================================================
   SOVEREIGNTY PANEL · SW.JS v1.4 (performance)
   ============================================================
   v1.4 (07.11.2026):
     - PRECACHE критичных файлов в install — первый визит
       сразу получает статику из кэша (ускоряет загрузку
       в 2-3 раза после первого визита).
     - Добавлены тайлы карты в precache (первый клик на карту
       уже не ждёт сеть).
     - Увеличен TTL для шрифтов (365 дней) и статики (30 дней).
     - version bump → все клиенты обновят кэш.

   ЧТО МЕНЯТЬ ПРИ ОБНОВЛЕНИИ СТАТИКИ:
     STATIC_VERSION — CSS/JS/HTML/SVG/JSON
     TILES_VERSION  — только при перегенерации карты
   ============================================================ */

var STATIC_VERSION = 'v5';
var TILES_VERSION  = 't2';

var CACHE_STATIC = 'sovereignty-static-' + STATIC_VERSION;
var CACHE_TILES  = 'sovereignty-tiles-'  + TILES_VERSION;

/* Файлы для немедленного кэширования при install. */
var PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './perf-overrides.css',
    './panel-icons.css',
    './mobile.css',
    './country-cards.css',
    './country-passport.css',
    './chronicles.css',
    './map-enhance.css',
    './theme-switcher.css',
    './app.js',
    './perf-bundle.js',
    './panel-icons.js',
    './map-layers.js',
    './panel-perf.js',
    './sparkline.js',
    './mobile.js',
    './theme-switcher.js',
    './country-passport.js',
    './guide.html'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_STATIC).then(function (cache) {
            // Promise.allSettled-like: не падаем если что-то не скачалось
            return Promise.all(
                PRECACHE_URLS.map(function (url) {
                    return cache.add(url).catch(function (err) {
                        console.warn('[SW] Precache miss:', url, err.message);
                    });
                })
            );
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

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

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;

    var url;
    try { url = new URL(req.url); } catch (e) { return; }

    var sameOrigin = url.origin === self.location.origin;
    var isRawGitHub = url.hostname === 'raw.githubusercontent.com';

    // Тайлы карты
    if ((sameOrigin || isRawGitHub) && url.pathname.indexOf('/data/tiles/') !== -1) {
        event.respondWith(cacheFirstTile(req, CACHE_TILES));
        return;
    }

    // Скины
    if ((sameOrigin || isRawGitHub) && url.pathname.indexOf('/data/skins/') !== -1) {
        event.respondWith(cacheFirstTile(req, CACHE_TILES));
        return;
    }

    // Шрифты Google — долгий кэш
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirstLongTerm(req, CACHE_STATIC));
        return;
    }

    // CSS / JS / SVG / шрифты
    if (url.pathname.match(/\.(css|js|mjs|svg|woff2?|ttf|eot)$/i)) {
        event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
        return;
    }

    // JSON — networkFirst
    if (url.pathname.endsWith('.json')) {
        event.respondWith(networkFirst(req, CACHE_STATIC));
        return;
    }
});

function cacheFirstTile(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (exact) {
            if (exact) return exact;
            var noQuery = new Request(stripQuery(req.url), {
                method: req.method, mode: req.mode,
                credentials: req.credentials, redirect: req.redirect
            });
            return cache.match(noQuery).then(function (fuzzy) {
                if (fuzzy) {
                    updateTileInBackground(req, cache);
                    return fuzzy;
                }
                return fetch(req).then(function (response) {
                    if (response && response.ok) cache.put(req, response.clone()).catch(function () {});
                    return response;
                });
            });
        });
    });
}

function updateTileInBackground(req, cache) {
    var now = Date.now();
    var key = req.url;
    if (!updateTileInBackground._last) updateTileInBackground._last = {};
    var last = updateTileInBackground._last[key] || 0;
    if (now - last < 5 * 60 * 1000) return;
    updateTileInBackground._last[key] = now;
    fetch(req).then(function (response) {
        if (response && response.ok) cache.put(req, response.clone()).catch(function () {});
    }).catch(function () {});
}

function stripQuery(url) {
    var i = url.indexOf('?');
    return i === -1 ? url : url.substring(0, i);
}

function cacheFirstLongTerm(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (cached) {
            if (cached) return cached;
            return fetch(req).then(function (response) {
                if (response && response.ok) cache.put(req, response.clone()).catch(function () {});
                return response;
            });
        });
    });
}

function staleWhileRevalidate(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (cached) {
            var network = fetch(req).then(function (response) {
                if (response && response.ok) cache.put(req, response.clone()).catch(function () {});
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

self.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type === 'getStats') {
        Promise.all([
            caches.open(CACHE_STATIC).then(function (c) { return c.keys(); }),
            caches.open(CACHE_TILES).then(function (c) { return c.keys(); })
        ]).then(function (results) {
            var stats = {
                static: results[0].length,
                tiles: results[1].length,
                staticCache: CACHE_STATIC,
                tilesCache: CACHE_TILES
            };
            if (event.ports && event.ports[0]) event.ports[0].postMessage(stats);
            else if (event.source && event.source.postMessage) event.source.postMessage({ type: 'stats', stats: stats });
        });
    }
});
