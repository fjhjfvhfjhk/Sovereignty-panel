/* ============================================================
   SOVEREIGNTY PANEL · PANEL-LOADING.JS v2.0
   ============================================================
   v2.0: упрощён. Убраны flash-анимации (row-flash, stat-flash,
   event-log flash-new, jackpot flash). Осталась только
   инициализация скелетонов при первой загрузке.

   Философия: одна анимация появления контента, а не пять.
   ============================================================ */
(function () {
    'use strict';

    function buildCountriesSkeleton() {
        var rows = '';
        for (var i = 0; i < 5; i++) {
            rows += '<tr class="skeleton-row">' +
                '<td><div class="panel-skeleton-block h-14 w-40"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-90"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-70"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-60"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-70"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-50"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-40"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-30"></div></td>' +
            '</tr>';
        }
        return '<tbody>' + rows + '</tbody>';
    }

    function buildEventLogSkeleton() {
        var items = '';
        for (var i = 0; i < 4; i++) {
            items += '<div class="panel-skeleton-row" style="padding:12px;background:rgba(168,138,72,.05);border-radius:2px;">' +
                '<div class="panel-skeleton-block h-20 w-20 round"></div>' +
                '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">' +
                    '<div class="panel-skeleton-block h-14 w-90"></div>' +
                    '<div class="panel-skeleton-block h-10 w-40"></div>' +
                '</div>' +
            '</div>';
        }
        return '<div class="panel-skeleton">' + items + '</div>';
    }

    function buildPlayersSkeleton() {
        var cards = '';
        for (var i = 0; i < 6; i++) {
            cards += '<div class="panel-skeleton-player">' +
                '<div class="panel-skeleton-block h-48 w-48 round"></div>' +
                '<div class="panel-skeleton-player-inner">' +
                    '<div class="panel-skeleton-block h-14 w-60"></div>' +
                    '<div class="panel-skeleton-block h-10 w-40"></div>' +
                    '<div class="panel-skeleton-block h-10 w-70"></div>' +
                '</div>' +
            '</div>';
        }
        return cards;
    }

    function injectSkeletons() {
        var tbody = document.getElementById('countries-body');
        if (tbody && tbody.textContent.indexOf('Загрузка') !== -1) {
            tbody.innerHTML = buildCountriesSkeleton();
        }

        var log = document.getElementById('event-log-list');
        if (log && log.textContent.indexOf('Загрузка') !== -1) {
            log.innerHTML = buildEventLogSkeleton();
        }

        var playersGrid = document.getElementById('players-grid');
        if (playersGrid && playersGrid.children.length === 0) {
            var empty = document.getElementById('players-empty');
            var isHidden = !empty || empty.style.display === 'none';
            if (isHidden) playersGrid.innerHTML = buildPlayersSkeleton();
        }
    }

    function installSkeletonWatcher() {
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            injectSkeletons();
            if (window.currentData || tries > 20) clearInterval(iv);
        }, 300);
    }

    function boot() {
        injectSkeletons();
        installSkeletonWatcher();
        console.log('[PanelLoading] v2.0 ready (skeleton only)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelLoading = {
        refresh: injectSkeletons
    };
})();
