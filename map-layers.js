/* map-layers.js v1.2
 * ============================================================
 * Управление слоями карты + синхронизация с ночным режимом.
 *
 * v1.2:
 *   - При смене world_time вызывается window.renderNightLights(),
 *     если он определён (для перерисовки световых пятен).
 * ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'map-layers-state';

    var state = {
        players: true,
        grid: false,
        dayNight: true,
        panelVisible: true
    };

    var lastWorldTime = -1;
    var lastMeta = null;

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (typeof parsed.players === 'boolean') state.players = parsed.players;
            if (typeof parsed.grid === 'boolean') state.grid = parsed.grid;
            if (typeof parsed.dayNight === 'boolean') state.dayNight = parsed.dayNight;
            if (typeof parsed.panelVisible === 'boolean') state.panelVisible = parsed.panelVisible;
        } catch (e) {}
    }

    function saveState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function $(id) { return document.getElementById(id); }

    function syncCheckboxes() {
        var p = $('layer-players'); if (p) p.checked = state.players;
        var g = $('layer-grid');    if (g) g.checked = state.grid;
        var d = $('layer-daynight'); if (d) d.checked = state.dayNight;
    }

    function applyPanelVisibility() {
        var panel = $('map-layers-panel');
        var restore = $('map-layers-restore');
        if (panel) panel.style.display = state.panelVisible ? '' : 'none';
        if (restore) restore.style.display = state.panelVisible ? 'none' : 'flex';
    }

    function applyLayers() {
        if (window.showPlayerMarkers !== undefined) {
            window.showPlayerMarkers = state.players;
        }

        var gridSvg = $('map-grid-svg');
        if (gridSvg) gridSvg.style.display = state.grid ? 'block' : 'none';

        var dayNight = $('map-daynight');
        if (dayNight) {
            if (!state.dayNight) {
                dayNight.style.opacity = '0';
            } else {
                updateDayNight(lastWorldTime);
            }
        }

        var playerCb = $('map-show-players');
        if (playerCb) playerCb.checked = state.players;

        if (typeof window.renderPlayerMarkers === 'function') {
            window.renderPlayerMarkers();
        }
    }

    function updateDayNight(worldTime) {
        lastWorldTime = worldTime;

        var overlay = $('map-daynight');
        var status = $('daynight-status');
        if (!overlay) return;

        if (!state.dayNight) {
            overlay.style.opacity = '0';
            if (status) status.textContent = 'День/ночь выкл';
            if (typeof window.renderNightLights === 'function') window.renderNightLights();
            return;
        }

        if (worldTime < 0) {
            overlay.style.opacity = '0';
            if (status) status.textContent = 'Время неизвестно';
            if (typeof window.renderNightLights === 'function') window.renderNightLights();
            return;
        }

        var r, g, b, opacity, phase;

        if (worldTime < 1000) {
            var t = worldTime / 1000.0;
            opacity = 0.35 * (1.0 - t);
            r = 40; g = 20; b = 60;
            phase = '🌅 Рассвет';
        } else if (worldTime < 11000) {
            opacity = 0; r = 0; g = 0; b = 0;
            phase = '☀️ День';
        } else if (worldTime < 13000) {
            var t2 = (worldTime - 11000) / 2000.0;
            opacity = 0.40 * t2;
            r = 80; g = 30; b = 40;
            phase = '🌇 Закат';
        } else if (worldTime < 22000) {
            opacity = 0.40;
            r = 15; g = 25; b = 70;
            phase = '🌙 Ночь';
        } else {
            var t3 = (worldTime - 22000) / 2000.0;
            opacity = 0.40 * (1.0 - t3) + 0.35 * t3;
            r = 40; g = 20; b = 60;
            phase = '🌄 Предрассвет';
        }

        overlay.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity.toFixed(3) + ')';
        overlay.style.opacity = opacity > 0 ? '1' : '0';

        if (status) {
            var h = Math.floor(worldTime / 1000);
            var m = Math.floor((worldTime % 1000) / 1000 * 60);
            status.textContent = phase + ' • ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }

        // v1.2: обновить яркость источников света
        if (typeof window.renderNightLights === 'function') window.renderNightLights();
    }

    function applyTransform(cssTransform) {
        var gridSvg = $('map-grid-svg');
        if (gridSvg) gridSvg.style.transform = cssTransform;
    }

    function onMapReady(width, height, meta) {
        lastMeta = meta;

        var gridSvg = $('map-grid-svg');
        if (gridSvg) {
            gridSvg.setAttribute('width', width);
            gridSvg.setAttribute('height', height);
            gridSvg.style.width = width + 'px';
            gridSvg.style.height = height + 'px';
        }
        var rect = $('map-grid-rect');
        if (rect) {
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
        }

        if (meta && typeof meta.world_time === 'number') {
            updateDayNight(meta.world_time);
        } else {
            updateDayNight(-1);
        }

        applyLayers();
        applyPanelVisibility();
    }

    function init() {
        loadState();
        syncCheckboxes();
        applyPanelVisibility();

        var p = $('layer-players');
        if (p) p.addEventListener('change', function () {
            state.players = p.checked;
            saveState();
            applyLayers();
        });
        var g = $('layer-grid');
        if (g) g.addEventListener('change', function () {
            state.grid = g.checked;
            saveState();
            applyLayers();
        });
        var d = $('layer-daynight');
        if (d) d.addEventListener('change', function () {
            state.dayNight = d.checked;
            saveState();
            applyLayers();
        });

        var mc = $('map-show-players');
        if (mc) mc.addEventListener('change', function () {
            state.players = mc.checked;
            saveState();
            syncCheckboxes();
        });

        var closeBtn = $('map-layers-close');
        if (closeBtn) closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            state.panelVisible = false;
            saveState();
            applyPanelVisibility();
        });

        var restoreBtn = $('map-layers-restore');
        if (restoreBtn) restoreBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            state.panelVisible = true;
            saveState();
            applyPanelVisibility();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MapLayers = {
        onMapReady: onMapReady,
        updateDayNight: updateDayNight,
        applyTransform: applyTransform,
        getState: function () { return state; }
    };
})();
