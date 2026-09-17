/* ============================================================
   patch-legend.js — v5.10
   ============================================================
   Добавь эту функцию в конец app.js.
   Затем в DOMContentLoaded добавь initMapSymbolLegend() в список:

     ['initTabs','initSortTabs','initMapControls','initMapFullscreen','initCommandCopy',
      'initCommandSearch','initPlayerControls','initModalControls','initMapSymbolLegend']
       .forEach(...)

   Функция: разворачивает/сворачивает легенду и запоминает состояние в
   localStorage. Состояние сохраняется между сессиями.
   ============================================================ */

var MAP_SYMBOL_LEGEND_KEY = 'map-symbol-legend-open';

/**
 * Инициализирует сворачивание легенды символов карты.
 * Работает идемпотентно — повторный вызов не создаёт дубликатов
 * обработчиков.
 */
function initMapSymbolLegend() {
    var panel = document.getElementById('map-symbol-legend');
    if (!panel) return;
    var header = document.getElementById('map-symbol-legend-header');
    var toggle = document.getElementById('map-symbol-legend-toggle');
    var body = document.getElementById('map-symbol-legend-body');
    if (!header || !body) return;

    // Если уже инициализировано — не дублируем обработчики.
    if (panel.dataset.legendInit === '1') return;
    panel.dataset.legendInit = '1';

    var stored = null;
    try { stored = localStorage.getItem(MAP_SYMBOL_LEGEND_KEY); } catch (e) {}
    var open = stored === null ? true : stored === 'true';
    applyOpen(open);

    function applyOpen(isOpen) {
        body.style.display = isOpen ? '' : 'none';
        panel.classList.toggle('collapsed', !isOpen);
        if (toggle) toggle.textContent = isOpen ? '▾' : '▸';
    }

    function toggleOpen() {
        open = !open;
        try { localStorage.setItem(MAP_SYMBOL_LEGEND_KEY, String(open)); } catch (e) {}
        applyOpen(open);
    }

    header.addEventListener('click', function (e) {
        // Клик по кнопке-переключателю внутри header тоже работает,
        // но не вызываем двойной toggle.
        if (e.target === toggle) return;
        toggleOpen();
    });
    if (toggle) {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleOpen();
        });
    }
}

window.initMapSymbolLegend = initMapSymbolLegend;
