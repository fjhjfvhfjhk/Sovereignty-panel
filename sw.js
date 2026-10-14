/* ============================================================
   SOVEREIGNTY PANEL · SW.JS (Service Worker) v1.3
   ============================================================
   v1.3 (15.10.2026):
     - ФИКС: тайлы с raw.githubusercontent.com теперь тоже
       кэшируются (раньше только same-origin).
     - ФИКС: устранено двойное кэширование из-за ?v= в URL
       тайлов. Теперь cache.match ищет по пути без query-string,
       но по-прежнему обновляет при изменении tiles_version.
     - ДОБАВЛЕН endpoint для отладки: SW отвечает на postMessage
       {type: 'stats'} с количеством закэшированных файлов.
     - Логирование каждого tile-запроса (в консоль).

   ЧТО МЕНЯТЬ ПРИ ОБНОВЛЕНИИ:
     STATIC_VERSION — стили, скрипты, HTML, шрифты
     TILES_VERSION  — только когда сервер перегенерировал карту
   ============================================================ */

var STATIC_VERSION = 'v3';
var TILES_VERSION  = 't1';

var CACHE_STATIC = 'sovereignty-static-' + STATIC_VERSION;
var CACHE_TILES  = 'sovereignty-tiles-'  + TILES_VERSION;

/* ============================================================
   INSTALL
   ============================================================ */
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

/* ============================================================
   ACTIVATE
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
   FETCH
   ============================================================ */
self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;

    var url;
    try { url = new URL(req.url); } catch (e) { return; }

    var sameOrigin = url.origin === self.location.origin;
    var isRawGitHub = url.hostname === 'raw.githubusercontent.com';

    /* ---- Тайлы карты (same-origin) ---- */
    if (sameOrigin && url.pathname.indexOf('/data/tiles/') !== -1) {
        event.respondWith(cacheFirstTile(req, CACHE_TILES));
        return;
    }

    /* ---- Тайлы карты (fallback на raw.githubusercontent.com) ---- */
    if (isRawGitHub && url.pathname.indexOf('/data/tiles/') !== -1) {
        event.respondWith(cacheFirstTile(req, CACHE_TILES));
        return;
    }

    /* ---- Скины игроков ---- */
    if ((sameOrigin || isRawGitHub) && url.pathname.indexOf('/data/skins/') !== -1) {
        event.respondWith(cacheFirstTile(req, CACHE_TILES));
        return;
    }

    /* ---- CSS / JS / шрифты / SVG ---- */
    if (url.pathname.match(/\.(css|js|mjs|svg|woff2?|ttf|eot)$/i)) {
        event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
        return;
    }

    /* ---- JSON ---- */
    if (url.pathname.endsWith('.json')) {
        event.respondWith(networkFirst(req, CACHE_STATIC));
        return;
    }
});

/* ============================================================
   Хелперы
   ============================================================ */

/**
 * cacheFirstTile — специально для тайлов.
 *
 * 1. Ищем ТОЧНОЕ совпадение (с ?v=) — быстро, для текущей версии.
 * 2. Если нет — ищем по пути БЕЗ ?v= (ignoreSearch) — это
 *    старый тайл от предыдущей версии. Отдаём его сразу,
 *    а в фоне тянем свежий и обновляем кэш.
 *
 * Так мы не теряем трафик: при неизменной карте (tiles_version
 * не менялся) всё берётся из кэша. При смене версии — старая
 * карта показывается мгновенно, новая догружается за кадром.
 */
function cacheFirstTile(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        // 1) Точное совпадение
        return cache.match(req).then(function (exact) {
            if (exact) {
                logTile('HIT', req, 'exact');
                return exact;
            }

            // 2) Совпадение по пути без ?v=
            var noQuery = new Request(stripQuery(req.url), {
                method: req.method,
                mode: req.mode,
                credentials: req.credentials,
                redirect: req.redirect,
                referrer: req.referrer,
                referrerPolicy: req.referrerPolicy,
                integrity: req.integrity,
                cache: req.cache
            });

            return cache.match(noQuery).then(function (fuzzy) {
                if (fuzzy) {
                    logTile('HIT', req, 'fuzzy');
                    // Фоновое обновление: тянем свежую версию
                    updateTileInBackground(req, cache);
                    return fuzzy;
                }

                // 3) Полный промах — качаем с сети
                logTile('MISS', req, 'fetch');
                return fetch(req).then(function (response) {
                    if (response && response.ok) {
                        cache.put(req, response.clone()).catch(function () {});
                    }
                    return response;
                });
            });
        });
    });
}

/**
 * В фоне тянет новую версию тайла и складывает её в кэш.
 * Не блокирует основной ответ.
 */
function updateTileInBackground(req, cache) {
    // Не спамим: обновляем не чаще 1 раза в 5 минут на тайл.
    var now = Date.now();
    var key = req.url;
    if (!updateTileInBackground._last) updateTileInBackground._last = {};
    var last = updateTileInBackground._last[key] || 0;
    if (now - last < 5 * 60 * 1000) return;
    updateTileInBackground._last[key] = now;

    fetch(req).then(function (response) {
        if (response && response.ok) {
            cache.put(req, response.clone()).catch(function () {});
        }
    }).catch(function () {});
}

function stripQuery(url) {
    var i = url.indexOf('?');
    return i === -1 ? url : url.substring(0, i);
}

function logTile(tag, req, reason) {
    var u = req.url;
    var name = u.substring(u.lastIndexOf('/') + 1);
    console.log('[SW][Tile][' + tag + ':' + reason + '] ' + name);
}

/**
 * cacheFirst — для нетайловых ресурсов.
 */
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

/* ============================================================
   PostMessage — статистика для клиента
   ============================================================ */
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
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage(stats);
            } else if (event.source && event.source.postMessage) {
                event.source.postMessage({ type: 'stats', stats: stats });
            }
        });
    }
});
