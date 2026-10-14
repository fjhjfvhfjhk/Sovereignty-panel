/* ============================================================
   SOVEREIGNTY PANEL · PANEL-PERF.JS v1.2
   ============================================================
   v1.2 (15.10.2026):
     - ДОБАВЛЕН диагностический режим: ?cache=1 — показывает
       внизу экрана плашку со статусом Service Worker и кэша.
       Помогает понять, работает ли кэширование тайлов.
     - ФИКС: регистрация SW теперь идёт сразу, не ждёт
       window.load. Это важно — на мобилке load может
       откладываться до загрузки карты.
     - ДОБАВЛЕНА проверка: если sw.js отдаёт 404 (файла нет
       в репозитории), в консоль пишется понятная ошибка.

   v1.1: разделены STATIC_VERSION и TILES_VERSION в sw.js.
   v1.0: первая версия — SW + lazy tiles + lazy avatars.
   ============================================================ */
(function () {
    'use strict';

    var SW_ENABLED = !new URLSearchParams(location.search).has('nosw');
    var DEFER_MAP = !/tab=map/.test(location.search);
    var SHOW_CACHE_STATS = /[?&]cache=1/.test(location.search);

    /* ============================================================
       1. SERVICE WORKER
       ============================================================ */
    function installServiceWorker() {
        if (!SW_ENABLED) {
            console.log('[Perf] SW отключён через ?nosw=1');
            return;
        }
        if (!('serviceWorker' in navigator)) {
            console.warn('[Perf] Браузер не поддерживает Service Worker');
            return;
        }
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.warn('[Perf] SW требует HTTPS — пропускаю');
            return;
        }

        var hadController = !!navigator.serviceWorker.controller;
        var refreshing = false;

        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (!hadController) {
                hadController = true;
                console.log('[Perf] SW взял управление впервые');
                return;
            }
            if (refreshing) return;
            refreshing = true;
            console.log('[Perf] SW обновился — перезагружаю');
            window.location.reload();
        });

        // Регистрируем сразу, не ждём load
        navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
            console.log('[Perf] SW зарегистрирован: scope=' + reg.scope);

            // Проверяем наличие активированного SW
            setTimeout(function () {
                if (navigator.serviceWorker.controller) {
                    console.log('[Perf] SW активен и контролирует страницу');
                } else {
                    console.log('[Perf] SW установлен, но ещё не контролирует (первый визит?)');
                }
            }, 500);

            // Раз в час проверяем обновления sw.js
            setInterval(function () {
                reg.update().catch(function () {});
            }, 60 * 60 * 1000);
        }).catch(function (err) {
            console.error('[Perf] SW не зарегистрирован:', err.message);
            console.error('[Perf] Проверь, что файл sw.js лежит в корне репозитория');
        });
    }

    /* ============================================================
       2. CONTENT-VISIBILITY
       ============================================================ */
    function installContentVisibility() {
        var style = document.createElement('style');
        style.textContent = [
            '.tab-content:not(.active) {',
            '    content-visibility: auto;',
            '    contain-intrinsic-size: 1px 600px;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ============================================================
       3. LAZY AVATARS
       ============================================================ */
    function markLazyAvatars() {
        var imgs = document.querySelectorAll(
            'img[data-pname]:not([data-lazy]), img[data-avatar-name]:not([data-lazy])'
        );
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            img.loading = 'lazy';
            img.decoding = 'async';
            img.setAttribute('data-lazy', '1');
        }
    }

    function watchAvatars() {
        if (!window.MutationObserver) return;
        var scheduled = false;
        var mo = new MutationObserver(function (mutations) {
            if (scheduled) return;
            var hasNew = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
                    hasNew = true;
                    break;
                }
            }
            if (!hasNew) return;
            scheduled = true;
            setTimeout(function () {
                scheduled = false;
                markLazyAvatars();
            }, 80);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    /* ============================================================
       4. ОТЛОЖЕННАЯ ЗАГРУЗКА КАРТЫ
       ============================================================ */
    function installDeferredMap() {
        if (!DEFER_MAP) {
            console.log('[Perf] карта не отложена (tab=map в URL)');
            return;
        }

        var tries = 0;
        function tryInstall() {
            tries++;
            var origLoadMap = window.loadMap;
            if (typeof origLoadMap !== 'function') {
                if (tries < 50) setTimeout(tryInstall, 100);
                return;
            }

            var mapHasLoaded = false;

            window.loadMap = function () {
                window.__pendingMapLoad = true;
            };

            function triggerLoad() {
                if (mapHasLoaded) return;
                mapHasLoaded = true;
                window.__pendingMapLoad = false;
                window.loadMap = origLoadMap;
                try {
                    origLoadMap.call(window);
                    console.log('[Perf] карта загружена по клику');
                } catch (e) {
                    console.error('[Perf] loadMap:', e);
                }
            }

            var mapBtn = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
            if (mapBtn) mapBtn.addEventListener('click', triggerLoad);

            document.addEventListener('click', function (e) {
                var btn = e.target.closest && e.target.closest('.bn-btn[data-tab="map"]');
                if (btn) triggerLoad();
            });

            console.log('[Perf] загрузка карты отложена до клика');
        }
        tryInstall();
    }

    /* ============================================================
       5. ЛЕНИВАЯ ЗАГРУЗКА ТАЙЛОВ
       ============================================================ */
    function installLazyTiles() {
        var tries = 0;
        function tryInstall() {
            tries++;
            if (typeof window.loadTile !== 'function' ||
                typeof window.loadAllTiles !== 'function') {
                if (tries < 50) setTimeout(tryInstall, 100);
                return;
            }

            var origLoadTile = window.loadTile;

            function getVisibleRange() {
                if (!window.tilesMeta || !window.mapCanvas) return null;
                var vp = document.getElementById('map-viewport');
                if (!vp) return null;

                var meta = window.tilesMeta;
                var ts = meta.tile_size;
                var vw = vp.clientWidth;
                var vh = vp.clientHeight;
                if (!vw || !vh) return null;

                var zoom = window.mapZoom || 1;
                var ox = window.mapOffsetX || 0;
                var oy = window.mapOffsetY || 0;

                // Margin 100 экранных пикселей (было 150 — уменьшено)
                var marginImg = 100 / Math.max(zoom, 0.001);

                var ix0 = (0 - ox) / zoom - marginImg;
                var iy0 = (0 - oy) / zoom - marginImg;
                var ix1 = (vw - ox) / zoom + marginImg;
                var iy1 = (vh - oy) / zoom + marginImg;

                return {
                    tx0: Math.max(0, Math.floor(ix0 / ts)),
                    ty0: Math.max(0, Math.floor(iy0 / ts)),
                    tx1: Math.min(meta.cols - 1, Math.floor(ix1 / ts)),
                    ty1: Math.min(meta.rows - 1, Math.floor(iy1 / ts))
                };
            }

            function loadVisible() {
                var r = getVisibleRange();
                if (!r) return;
                var count = 0;
                for (var ty = r.ty0; ty <= r.ty1; ty++) {
                    for (var tx = r.tx0; tx <= r.tx1; tx++) {
                        try {
                            origLoadTile(tx, ty, null);
                            count++;
                        } catch (e) {
                            console.warn('[Perf] loadTile(' + tx + ',' + ty + ')', e);
                        }
                    }
                }
                console.log('[Perf] lazy tiles: запрошено ' + count +
                            ' тайлов в диапазоне x[' + r.tx0 + '..' + r.tx1 +
                            '] y[' + r.ty0 + '..' + r.ty1 + ']');
            }

            window.loadAllTiles = function () {
                setTimeout(loadVisible, 100);
            };

            var origApply = window.applyMapTransform;
            if (typeof origApply === 'function') {
                var debounce = null;
                window.applyMapTransform = function () {
                    var result = origApply.apply(this, arguments);
                    if (debounce) clearTimeout(debounce);
                    debounce = setTimeout(loadVisible, 200);
                    return result;
                };
            }

            console.log('[Perf] ленивая загрузка тайлов установлена');
        }
        tryInstall();
    }

    /* ============================================================
       6. ДИАГНОСТИЧЕСКАЯ ПЛАШКА (только с ?cache=1)
       ============================================================ */
    function installCacheStatus() {
        if (!SHOW_CACHE_STATS) return;

        var pill = document.createElement('div');
        pill.id = 'perf-cache-pill';
        pill.style.cssText = [
            'position:fixed',
            'bottom:calc(env(safe-area-inset-bottom, 0px) + 16px)',
            'left:16px',
            'background:rgba(42,26,15,.92)',
            'color:#F4EBD3',
            'font-family:system-ui,sans-serif',
            'font-size:12px',
            'line-height:1.5',
            'padding:10px 14px',
            'border:1px solid #C9A860',
            'border-radius:6px',
            'z-index:9998',
            'max-width:280px',
            'box-shadow:0 6px 20px rgba(0,0,0,.5)',
            'cursor:pointer',
            'white-space:pre-line'
        ].join(';');
        pill.textContent = 'Проверка кэша…';
        pill.title = 'Клик — скрыть';
        pill.addEventListener('click', function () { pill.remove(); });
        document.body.appendChild(pill);

        function refresh() {
            var sw = 'не поддерживается';
            if ('serviceWorker' in navigator) {
                if (navigator.serviceWorker.controller) {
                    sw = 'активен';
                } else if (navigator.serviceWorker.ready) {
                    sw = 'регистрируется…';
                } else {
                    sw = 'не установлен';
                }
            }

            var lines = ['SW: ' + sw];

            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                var mc = new MessageChannel();
                mc.port1.onmessage = function (e) {
                    var s = e.data || {};
                    var staticN = s.static || 0;
                    var tilesN = s.tiles || 0;
                    var total = staticN + tilesN;
                    lines = [
                        'SW: активен',
                        'Кэш статики: ' + staticN + ' файлов',
                        'Кэш тайлов: ' + tilesN + ' файлов',
                        'Всего: ' + total + ' файлов',
                        '',
                        'Если тайлы = 0 после визита на карту —',
                        'значит SW не перехватывает запросы.'
                    ];
                    pill.textContent = lines.join('\n');
                };
                navigator.serviceWorker.controller.postMessage({ type: 'getStats' }, [mc.port2]);
                setTimeout(function () {
                    pill.textContent = lines.join('\n');
                }, 800);
            } else {
                lines.push('');
                lines.push('SW не контролирует страницу.');
                lines.push('Проверь: файл sw.js в корне репо.');
                lines.push('Обычно нужен второй визит,');
                lines.push('чтобы SW активировался.');
                pill.textContent = lines.join('\n');
            }
        }

        setTimeout(refresh, 1000);
        setTimeout(refresh, 5000);
    }

    /* ============================================================
       BOOT
       ============================================================ */
    function boot() {
        installServiceWorker();
        installContentVisibility();
        installDeferredMap();
        installLazyTiles();
        markLazyAvatars();
        watchAvatars();
        installCacheStatus();
        console.log('[Perf] v1.2 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
