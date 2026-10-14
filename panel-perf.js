/* ============================================================
   SOVEREIGNTY PANEL · PANEL-PERF.JS v1.0
   ============================================================
   Клиентские оптимизации веса панели. Не трогает плагины,
   не трогает data/ — только то, что делает браузер.

   ЧТО ДЕЛАЕТ:

   1. Service Worker
        Регистрирует sw.js. Тайлы карты и скины кэшируются
        навсегда, CSS/JS — stale-while-revalidate.
        Повторные визиты грузятся из кэша = 0 МБ трафика.

   2. content-visibility: auto
        Скрытые вкладки не рендерятся, пока пользователь их
        не откроет. Экономит CPU на слабых устройствах.

   3. Lazy avatars
        Все <img data-pname> и <img data-avatar-name> получают
        loading="lazy" decoding="async".
        Аватарки грузятся только когда попадают в viewport.

   4. Отложенная загрузка карты
        window.loadMap() перехватывается. Реальная загрузка
        происходит только при клике на вкладку «Карта».
        Если пользователь сидит на «Обзоре» — тайлы (6–10 МБ)
        вообще не качаются.

   5. Ленивая загрузка тайлов
        loadAllTiles() перехватывается. Грузятся только
        тайлы в текущем viewport + небольшой margin.
        При зуме/панораме — догружаются новые.

   ОТКЛЮЧЕНИЕ (для отладки):
        ?nosw=1  — не регистрировать SW
        ?tab=map — карта грузится сразу (без отложки)

   ПОДКЛЮЧЕНИЕ: сразу после app.js.
     <script src="app.js?v=5.9"></script>
     <script src="panel-perf.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    /* --------------------------------------------------------
       Флаги
       -------------------------------------------------------- */
    var SW_ENABLED = !new URLSearchParams(location.search).has('nosw');
    var DEFER_MAP = !/tab=map/.test(location.search);

    /* ============================================================
       1. SERVICE WORKER
       ============================================================ */
    function installServiceWorker() {
        if (!SW_ENABLED) {
            console.log('[Perf] SW отключён через ?nosw=1');
            return;
        }
        if (!('serviceWorker' in navigator)) return;
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.log('[Perf] SW требует HTTPS — пропускаю');
            return;
        }

        var hadController = !!navigator.serviceWorker.controller;
        var refreshing = false;

        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (!hadController) {
                hadController = true;
                return;
            }
            if (refreshing) return;
            refreshing = true;
            console.log('[Perf] SW обновился — перезагружаю страницу');
            window.location.reload();
        });

        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.js').then(function (reg) {
                console.log('[Perf] SW зарегистрирован, scope:', reg.scope);
                // Проверяем обновления раз в час
                setInterval(function () {
                    reg.update().catch(function () {});
                }, 60 * 60 * 1000);
            }).catch(function (err) {
                console.warn('[Perf] SW не зарегистрирован:', err.message);
            });
        });
    }

    /* ============================================================
       2. CONTENT-VISIBILITY ДЛЯ НЕАКТИВНЫХ ВКЛАДОК
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
                // Откладываем до клика на карту
                window.__pendingMapLoad = true;
            };

            function triggerLoad() {
                if (mapHasLoaded) return;
                mapHasLoaded = true;
                window.__pendingMapLoad = false;
                // Возвращаем оригинал
                window.loadMap = origLoadMap;
                try {
                    origLoadMap.call(window);
                    console.log('[Perf] карта загружена по клику');
                } catch (e) {
                    console.error('[Perf] loadMap:', e);
                }
            }

            // Кнопка карты в основной навигации
            var mapBtn = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
            if (mapBtn) mapBtn.addEventListener('click', triggerLoad);

            // Bottom-nav (мобилка)
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

                // Margin 150 экранных пикселей, переводим в изображение
                var marginImg = 150 / Math.max(zoom, 0.001);

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

            var loadedCount = 0;
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
                loadedCount += count;
            }

            // Замена eager loadAllTiles
            window.loadAllTiles = function () {
                // Даём resetMapView шанс установить transform
                setTimeout(loadVisible, 100);
            };

            // Хук на applyMapTransform — панорама/зум
            var origApply = window.applyMapTransform;
            if (typeof origApply === 'function') {
                var debounce = null;
                window.applyMapTransform = function () {
                    var result = origApply.apply(this, arguments);
                    if (debounce) clearTimeout(debounce);
                    debounce = setTimeout(loadVisible, 120);
                    return result;
                };
            }

            console.log('[Perf] ленивая загрузка тайлов установлена');
        }
        tryInstall();
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
        console.log('[Perf] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
