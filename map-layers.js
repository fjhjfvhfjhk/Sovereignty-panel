/* map-layers.js v1.0
 * ============================================================
 * Управление слоями карты:
 *   - Сетка чанков (SVG pattern)
 *   - Игроки (checkbox - уже в app.js, но синхронизируем)
 *   - День/Ночь overlay (зависит от map_meta.world_time)
 *
 * Экспортирует window.MapLayers с методами:
 *   onMapReady(width, height, meta)
 *   updateDayNight(worldTime)
 *   applyTransform(cssTransform)
 *   getState()
 * ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'map-layers-state';

    var state = {
        players: true,
        grid: false,
        dayNight: true
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
        } catch (e) {}
    }

    function saveState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function $(id) { return document.getElementById(id); }

    /** Проставить чекбоксы в соответствии с state. */
    function syncCheckboxes() {
        var p = $('layer-players'); if (p) p.checked = state.players;
        var g = $('layer-grid');    if (g) g.checked = state.grid;
        var d = $('layer-daynight'); if (d) d.checked = state.dayNight;
    }

    /** Применить видимость слоёв. */
    function applyLayers() {
        // Игроки — управляется в app.js через showPlayerMarkers,
        // но мы дублируем галочку в наш state
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

        // Обновить чекбокс игроков в app.js (он отдельный)
        var playerCb = $('map-show-players');
        if (playerCb) playerCb.checked = state.players;

        // Пересобрать маркеры, если функция доступна
        if (typeof window.renderPlayerMarkers === 'function') {
            window.renderPlayerMarkers();
        }
    }

    /**
     * Обновить overlay день/ночь по времени мира.
     * worldTime: 0..24000 (0 = рассвет, 6000 = полдень, 12000 = закат, 18000 = полночь)
     */
    function updateDayNight(worldTime) {
        lastWorldTime = worldTime;

        var overlay = $('map-daynight');
        var status = $('daynight-status');
        if (!overlay) return;

        if (!state.dayNight) {
            overlay.style.opacity = '0';
            if (status) status.textContent = 'День/ночь выкл';
            return;
        }

        if (worldTime < 0) {
            overlay.style.opacity = '0';
            if (status) status.textContent = 'Время неизвестно';
            return;
        }

        // Определяем фазу:
        //   0..1000      рассвет (переход от ночи к дню)
        //   1000..11000  день (прозрачно)
        //   11000..13000 закат (переход от дня к ночи)
        //   13000..22000 ночь (тёмно-синий)
        //   22000..24000 рассвет-восход (переход к дню)

        var r, g, b, opacity;
        var phase;

        if (worldTime < 1000) {
            // рассвет 0..1000: opacity 0.35 → 0
            var t = worldTime / 1000.0;
            opacity = 0.35 * (1.0 - t);
            r = 40; g = 20; b = 60;
            phase = '🌅 Рассвет';
        } else if (worldTime < 11000) {
            opacity = 0;
            r = 0; g = 0; b = 0;
            phase = '☀️ День';
        } else if (worldTime < 13000) {
            // закат 11000..13000
            var t2 = (worldTime - 11000) / 2000.0;
            opacity = 0.40 * t2;
            r = 80; g = 30; b = 40;
            phase = '🌇 Закат';
        } else if (worldTime < 22000) {
            opacity = 0.40;
            r = 15; g = 25; b = 70;
            phase = '🌙 Ночь';
        } else {
            // 22000..24000 переход к рассвету
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
    }

    /** Установить CSS transform для слоя сетки (синхронно с картой). */
    function applyTransform(cssTransform) {
        var gridSvg = $('map-grid-svg');
        if (gridSvg) {
            gridSvg.style.transform = cssTransform;
        }
    }

    /**
     * Вызывается из app.js после загрузки PNG.
     * width, height — размер canvas (в пикселях).
     * meta — map_meta из JSON.
     */
    function onMapReady(width, height, meta) {
        lastMeta = meta;

        // Проставить размер SVG-сетки = размер карты
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

        // Day/night по времени мира
        if (meta && typeof meta.world_time === 'number') {
            updateDayNight(meta.world_time);
        } else {
            updateDayNight(-1);
        }

        // Применить видимость слоёв
        applyLayers();
    }

    function init() {
        loadState();
        syncCheckboxes();

        // Обработчики чекбоксов
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

        // Синхронизация с main чекбоксом игроков (он в app.js)
        var mc = $('map-show-players');
        if (mc) mc.addEventListener('change', function () {
            state.players = mc.checked;
            saveState();
            syncCheckboxes();
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
