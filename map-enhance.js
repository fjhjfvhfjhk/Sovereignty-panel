/* ============================================================
   SOVEREIGNTY PANEL · MAP-ENHANCE.JS v1.0
   ============================================================
   Улучшения карты:

     1. Кнопка «К моей столице» — центрирует карту на столице
        лидера текущего пользователя (из URL ?player=<ник> или
        первой столицы в списке).
     2. Hover-tooltip на маркерах игроков — ник + страна + баланс.
     3. Счётчик онлайн-игроков в углу карты.
     4. Плавное перемещение маркеров при обновлении данных.

   Подключать ПОСЛЕ app.js и map-layers.js:
     <script src="app.js"></script>
     <script src="map-enhance.js"></script>
   ============================================================ */
(function () {
    'use strict';

    // ============================================================
    // 1. Кнопка «К моей столице»
    // ============================================================

    function installCapitalButton() {
        var controls = document.querySelector('.map-controls');
        if (!controls) return;
        if (controls.querySelector('.btn-capital')) return;

        var btn = document.createElement('button');
        btn.className = 'map-btn btn-capital';
        btn.textContent = '🏛 К моей столице';
        btn.title = 'Центрировать карту на столице твоей страны';
        btn.addEventListener('click', function () {
            goToCapital();
        });

        // Вставляем перед кнопкой «Полный экран»
        var fs = document.getElementById('map-fullscreen');
        if (fs) controls.insertBefore(btn, fs);
        else controls.appendChild(btn);
    }

    /** Определяет «мою страну». Пробуем URL param ?player=<ник>. */
    function detectMyCountry() {
        var data = window.currentData;
        if (!data || !data.players) return null;

        // Из URL param
        var urlPlayer = getUrlParam('player');
        if (urlPlayer) {
            for (var i = 0; i < data.players.length; i++) {
                if (data.players[i].name.toLowerCase() === urlPlayer.toLowerCase()) {
                    return data.players[i].country;
                }
            }
        }

        // Fallback: первая страна из списка
        if (data.countries && data.countries.length > 0) {
            return data.countries[0].name;
        }

        return null;
    }

    function getUrlParam(key) {
        try {
            var params = new URLSearchParams(window.location.search);
            return params.get(key);
        } catch (e) { return null; }
    }

    function goToCapital() {
        var data = window.currentData;
        if (!data) {
            if (window.showToast) window.showToast('Данные ещё не загружены');
            return;
        }

        var country = detectMyCountry();
        if (!country) {
            if (window.showToast) window.showToast('Не удалось определить страну');
            return;
        }

        // Ищем страну
        var info = (data.countries || []).filter(function (c) { return c.name === country; })[0];
        if (!info || !info.capital) {
            if (window.showToast) window.showToast('У страны «' + country + '» нет столицы');
            return;
        }

        // Центрируем карту на столице
        var meta = data.map_meta;
        if (!meta) {
            if (window.showToast) window.showToast('Метаданные карты недоступны');
            return;
        }

        // Переключаемся на вкладку карты
        var mapTab = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
        if (mapTab) mapTab.click();

        setTimeout(function () {
            try {
                // Считаем позицию центра столицы в пикселях картинки
                var ppb = meta.pixels_per_block || 1;
                var capX = info.capital.chunk_x * 16 + 8;
                var capZ = info.capital.chunk_z * 16 + 8;
                var minX = meta.min_chunk_x * 16;
                var minZ = meta.min_chunk_z * 16;

                var px = (capX - minX) * ppb;
                var pz = (capZ - minZ) * ppb;

                // Ставим зум = 2, центрируем на столице
                var vp = document.getElementById('map-viewport');
                if (!vp) return;
                var vw = vp.clientWidth;
                var vh = vp.clientHeight;

                var zoom = 2;
                window.mapZoom = zoom;
                window.mapOffsetX = vw / 2 - px * zoom;
                window.mapOffsetY = vh / 2 - pz * zoom;

                // Если есть публичная функция — вызываем
                if (typeof window.applyMapTransform === 'function') {
                    window.applyMapTransform();
                } else {
                    // Fallback — ищем canvas и трансформируем вручную
                    var canvas = document.getElementById('map-canvas');
                    if (canvas) {
                        var t = 'translate(' + window.mapOffsetX + 'px,' + window.mapOffsetY + 'px) scale(' + zoom + ')';
                        canvas.style.transform = t;
                        var overlay = document.getElementById('map-overlay');
                        if (overlay) overlay.style.transform = t;
                        var battleLayer = document.getElementById('map-battle-layer');
                        if (battleLayer) battleLayer.style.transform = t;
                        var nightLayer = document.getElementById('map-night-layer');
                        if (nightLayer) nightLayer.style.transform = t;
                    }
                }

                // Мигаем столицей
                flashCapital();

                if (window.showToast) window.showToast('Столица: ' + country);
            } catch (e) {
                console.error('[MapEnhance] goToCapital:', e);
            }
        }, 250);
    }

    function flashCapital() {
        // Небольшая вспышка — для акцента
        var vp = document.getElementById('map-viewport');
        if (!vp) return;
        var flash = document.createElement('div');
        flash.style.cssText =
            'position:absolute;inset:0;pointer-events:none;z-index:30;' +
            'background:radial-gradient(circle at 50% 50%, rgba(251,191,36,.28), transparent 60%);' +
            'opacity:1;transition:opacity .8s cubic-bezier(.2,1,.3,1);';
        vp.appendChild(flash);
        setTimeout(function () { flash.style.opacity = '0'; }, 60);
        setTimeout(function () { flash.remove(); }, 1000);
    }

    // ============================================================
    // 2. HOVER-TOOLTIP на маркерах
    // ============================================================

    function enhanceMarkers() {
        var overlay = document.getElementById('map-overlay');
        if (!overlay) return;
        var markers = overlay.querySelectorAll('.map-marker');
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            if (marker.dataset.tooltip === '1') continue;
            marker.dataset.tooltip = '1';
            attachTooltip(marker);
        }
    }

    function attachTooltip(marker) {
        // Ищем ник
        var label = marker.querySelector('.map-marker-label');
        var name = label ? label.textContent.trim() : '';
        if (!name) return;

        var data = window.currentData;
        if (!data || !data.players) return;

        var player = null;
        for (var i = 0; i < data.players.length; i++) {
            if (data.players[i].name === name) { player = data.players[i]; break; }
        }
        if (!player) return;

        // Убираем нативный title (уже не нужен)
        marker.removeAttribute('title');

        var country = player.country || 'Без страны';
        var balance = player.balance != null ? formatMoney(player.balance) : null;
        var status = player.online ? 'online' : 'offline';
        var statusText = player.online ? 'Онлайн' : 'Оффлайн';

        var html =
            '<div class="mt-name">' + escapeHtml(name) + '</div>' +
            '<div class="mt-country">🏛 ' + escapeHtml(country) + '</div>' +
            '<div class="mt-row">' +
                '<span><span class="mt-status ' + status + '"></span>' + statusText + '</span>' +
                (balance != null ? '<span><b>' + balance + '</b></span>' : '') +
            '</div>';

        var tip = document.createElement('div');
        tip.className = 'marker-tooltip';
        tip.innerHTML = html;
        marker.appendChild(tip);
    }

    function formatMoney(a) {
        if (a == null) return '0';
        var abs = Math.abs(a);
        if (abs >= 1000000) return (a / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (a / 1000).toFixed(1) + 'k';
        return Math.round(a).toString();
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    // ============================================================
    // 3. Счётчик онлайн-игроков на карте
    // ============================================================

    function installOnlineCounter() {
        var vp = document.getElementById('map-viewport');
        if (!vp) return;
        if (vp.querySelector('.map-online-counter')) return;

        var counter = document.createElement('div');
        counter.className = 'map-online-counter';
        counter.id = 'map-online-counter';
        counter.innerHTML = '<b>0</b> онлайн';
        vp.appendChild(counter);
        updateOnlineCounter();
    }

    function updateOnlineCounter() {
        var counter = document.getElementById('map-online-counter');
        if (!counter) return;
        var data = window.currentData;
        if (!data) return;
        var online = data.online_players || 0;
        var max = data.max_players || 0;
        counter.innerHTML = '<b>' + online + '</b> / ' + max + ' онлайн';
    }

    // ============================================================
    // 4. Tick — периодически обновляем
    // ============================================================

    var lastUpdatedAt = 0;

    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(function () {
                    enhanceMarkers();
                    updateOnlineCounter();
                }, 250);
            }
            // Постоянно — на случай нового рендера
            enhanceMarkers();
        } catch (e) {}
        setTimeout(tick, 1200);
    }

    // ============================================================
    // Boot
    // ============================================================

    function boot() {
        installCapitalButton();
        installOnlineCounter();

        setTimeout(function () {
            enhanceMarkers();
            updateOnlineCounter();
        }, 800);

        tick();
        console.log('[MapEnhance] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelMap = {
        goToCapital: goToCapital,
        refresh: function () {
            enhanceMarkers();
            updateOnlineCounter();
        }
    };
})();
