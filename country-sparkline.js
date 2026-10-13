/* ============================================================
   SOVEREIGNTY PANEL · COUNTRY-SPARKLINE.JS v1.0
   ============================================================
   Мини-график за 7 дней на карточке страны (SVG).
   Читает claims_history[] из JSON (добавлено в JsonBuilder v1.4).

   ПОДКЛЮЧЕНИЕ: после country-cards.js.
   ============================================================ */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var WIDTH = 100;
    var HEIGHT = 28;

    /**
     * Строит SVG-string для мини-графика.
     * @param {number[]} history массив значений (7 точек)
     * @param {string} color цвет линии
     * @returns {string} SVG в виде строки
     */
    function buildSparklineSVG(history, color) {
        if (!history || history.length < 2) return '';

        var min = Math.min.apply(null, history);
        var max = Math.max.apply(null, history);
        var range = max - min;
        if (range === 0) range = 1;

        // Внутренние отступы
        var padX = 2;
        var padY = 4;
        var innerW = WIDTH - padX * 2;
        var innerH = HEIGHT - padY * 2;

        var pts = [];
        for (var i = 0; i < history.length; i++) {
            var x = padX + (i / (history.length - 1)) * innerW;
            // SVG ось Y направлена вниз, инвертируем
            var y = padY + (1 - (history[i] - min) / range) * innerH;
            pts.push({ x: x, y: y });
        }

        // Линия
        var lineD = pts.map(function (p, i) {
            return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
        }).join(' ');

        // Полигон заливки под линией
        var fillD = lineD +
            ' L' + pts[pts.length - 1].x.toFixed(1) + ',' + (HEIGHT - padY) +
            ' L' + pts[0].x.toFixed(1) + ',' + (HEIGHT - padY) + ' Z';

        // Градиент ID — уникальный на карточку, чтобы не пересекались
        var gradId = 'g' + Math.random().toString(36).slice(2, 8);

        // Последняя точка — крупная
        var last = pts[pts.length - 1];

        var svg =
            '<svg xmlns="' + SVG_NS + '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" ' +
                 'class="ccm-sparkline-svg" preserveAspectRatio="none" aria-hidden="true">' +
                '<defs>' +
                    '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
                        '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.35"/>' +
                        '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/>' +
                    '</linearGradient>' +
                '</defs>' +
                '<path d="' + fillD + '" fill="url(#' + gradId + ')" stroke="none"/>' +
                '<path d="' + lineD + '" fill="none" stroke="' + color + '" ' +
                       'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<circle cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" ' +
                        'r="2.2" fill="' + color + '" stroke="rgba(255,255,255,0.7)" ' +
                        'stroke-width="0.8"/>' +
            '</svg>';

        return svg;
    }

    /**
     * Обходит все карточки в #country-cards-mobile и вставляет
     * sparkline в каждую по её data-country.
     */
    function injectSparklines() {
        var container = document.getElementById('country-cards-mobile');
        if (!container) return;

        var data = window.currentData;
        if (!data || !data.countries) return;

        var map = {};
        data.countries.forEach(function (c) { map[c.name] = c; });

        var cards = container.querySelectorAll('.ccm-card');
        cards.forEach(function (card) {
            if (card.querySelector('.ccm-sparkline-wrap')) return;

            // Имя страны — из onclick атрибута или из .ccm-name
            var nameEl = card.querySelector('.ccm-name');
            if (!nameEl) return;
            var name = nameEl.textContent.replace(/🏛️/g, '').trim();
            var country = map[name];
            if (!country) return;

            var history = country.claims_history;
            if (!history || history.length < 2) return;

            var color = country.color || '#6366f1';

            var wrap = document.createElement('div');
            wrap.className = 'ccm-sparkline-wrap';
            wrap.innerHTML = buildSparklineSVG(history, color);

            // Подпись справа сверху
            var delta = country.claims_delta_7d || 0;
            var deltaStr = delta > 0 ? '+' + delta : (delta < 0 ? String(delta) : '0');
            var deltaCls = delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat');

            var label = document.createElement('div');
            label.className = 'ccm-sparkline-label ccm-stat-value delta ' + deltaCls;
            label.textContent = deltaStr;

            wrap.appendChild(label);
            card.appendChild(wrap);
        });
    }

    // ============================================================
    // Boot
    // ============================================================
    function boot() {
        // Ждём появления карточек
        setTimeout(injectSparklines, 400);
        setTimeout(injectSparklines, 1200);
        setTimeout(injectSparklines, 2500);
        setTimeout(injectSparklines, 5000);
        console.log('[CountrySparkline] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.CountrySparkline = { refresh: injectSparklines };
})();
