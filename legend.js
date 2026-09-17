/* ============================================================
   legend.js v1.1 — самоинициализирующийся модуль легенды карты
   ============================================================
   Подключается в index.html через:
       <script src="legend.js?v=1.1"></script>

   Не требует правок app.js. Инициализируется сразу после DOM ready.
   Сворачивание сохраняется в localStorage.
   ============================================================ */

(function () {
    'use strict';

    var STORAGE_KEY = 'map-symbol-legend-open';

    function init() {
        var panel = document.getElementById('map-symbol-legend');
        if (!panel) return;
        if (panel.dataset.legendInit === '1') return;
        panel.dataset.legendInit = '1';

        var header = document.getElementById('map-symbol-legend-header');
        var toggle = document.getElementById('map-symbol-legend-toggle');
        var body = document.getElementById('map-symbol-legend-body');
        if (!body) {
            console.warn('[Legend] #map-symbol-legend-body не найден');
            return;
        }

        var open = true;
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored !== null) open = (stored === 'true');
        } catch (e) {}

        function applyOpen(isOpen) {
            body.style.display = isOpen ? '' : 'none';
            panel.classList.toggle('collapsed', !isOpen);
            if (toggle) toggle.textContent = isOpen ? '▾' : '▸';
        }

        function setOpen(isOpen) {
            open = isOpen;
            try { localStorage.setItem(STORAGE_KEY, String(open)); } catch (e) {}
            applyOpen(open);
        }

        applyOpen(open);

        function handleToggle(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            setOpen(!open);
        }

        if (header) {
            header.addEventListener('click', handleToggle);
        }

        console.log('[Legend] Инициализировано. Начальное состояние: ' + (open ? 'открыто' : 'свёрнуто'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(init, 0);
        });
    } else {
        setTimeout(init, 0);
    }

    window.initMapSymbolLegend = init;
})();
