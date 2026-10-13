/* ============================================================
   SOVEREIGNTY PANEL · WORLD-TIMELINE.JS v1.0
   ============================================================
   Таймлайн мировых событий за 24 часа под графиком онлайна.

   Рисует canvas с горизонтальной шкалой (24 часа), маркеры
   событий из event_log. Наведение — tooltip с описанием.

   ПОДКЛЮЧЕНИЕ: последним <script>.
   ============================================================ */
(function () {
    'use strict';

    var TTL_MS = 24 * 3600 * 1000;
    var lastUpdatedAt = 0;
    var hoveredEventIdx = -1;
    var canvasData = { points: [], width: 0, height: 0 };

    // Цвета по типам
    var COLORS = {
        war:        '#B83A2E',
        war_ended:  '#52682A',
        capitulation:'#7A9048',
        capital_captured: '#D04040',
        npc_capital_captured: '#D04040',
        capital_set: '#A88A48',
        country_created: '#52682A',
        country_deleted: '#8B2020',
        country_renamed: '#A88A48',
        pact_signed: '#5A8CB4',
        jackpot_won: '#C040A0',
        big_win: '#C9A860',
        court_verdict: '#B87320',
        event_started: '#8A4AA8',
        event_ended: '#8A4AA8',
        event_winner: '#C9A860',
        boss_killed: '#6A3F1E'
    };

    var LEGEND = [
        { label: '⚔ Войны', color: COLORS.war },
        { label: '🏛 Страны', color: COLORS.country_created },
        { label: '🤝 Пакты', color: COLORS.pact_signed },
        { label: '🎁 Ивенты', color: COLORS.event_started },
        { label: '💰 Выигрыши', color: COLORS.jackpot_won }
    ];

    function colorFor(type) {
        return COLORS[type] || '#8A7558';
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    // ============================================================
    // 1. Инжект контейнера в DOM (после sparkline)
    // ============================================================
    function ensureContainer() {
        if (document.getElementById('world-timeline')) return;

        var chartPanel = document.getElementById('panel-online-chart');
        if (!chartPanel) return;

        // Найти, куда вставить. Хотим после .sparkline-wrap внутри
        // той же панели, но перед её закрытием.
        var sparkline = chartPanel.querySelector('.sparkline-wrap');
        if (!sparkline) return;

        var wrap = document.createElement('div');
        wrap.id = 'world-timeline';
        wrap.className = 'world-timeline';
        wrap.innerHTML =
            '<div class="world-timeline-header">' +
                '<div class="world-timeline-title">📜 Летопись 24 часов</div>' +
                '<div class="world-timeline-hint">Наведите на точку</div>' +
            '</div>' +
            '<div class="world-timeline-canvas-wrap">' +
                '<canvas class="world-timeline-canvas" id="world-timeline-canvas"></canvas>' +
                '<div class="wt-tooltip" id="wt-tooltip"></div>' +
            '</div>' +
            '<div class="wt-legend" id="wt-legend"></div>';

        sparkline.parentNode.insertBefore(wrap, sparkline.nextSibling);

        // Легенда
        var legend = wrap.querySelector('#wt-legend');
        legend.innerHTML = LEGEND.map(function (l) {
            return '<span class="wt-legend-item">' +
                '<span class="wt-legend-dot" style="background:' + l.color + ';"></span>' +
                escapeHtml(l.label) +
            '</span>';
        }).join('');
    }

    // ============================================================
    // 2. Рендер таймлайна
    // ============================================================
    function render() {
        ensureContainer();
        var canvas = document.getElementById('world-timeline-canvas');
        if (!canvas) return;

        var data = window.currentData;
        if (!data) return;

        var wrap = canvas.parentElement;
        var dpr = window.devicePixelRatio || 1;
        var w = wrap.clientWidth || 800;
        var h = wrap.clientHeight || 56;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.clearRect(0, 0, w, h);

        // Ось X
        var now = Date.now();
        var start = now - TTL_MS;

        // Вертикальные деления каждые 3 часа
        ctx.strokeStyle = 'rgba(168, 138, 72, 0.25)';
        ctx.lineWidth = 1;
        for (var i = 0; i <= 8; i++) {
            var px = (i / 8) * w;
            ctx.beginPath();
            ctx.moveTo(px, 12);
            ctx.lineTo(px, h - 12);
            ctx.stroke();

            // Подписи времени
            var t = new Date(start + i * (TTL_MS / 8));
            ctx.fillStyle = 'rgba(168, 138, 72, 0.7)';
            ctx.font = '10px system-ui, sans-serif';
            ctx.textAlign = i === 0 ? 'left' : (i === 8 ? 'right' : 'center');
            ctx.fillText(pad2(t.getHours()) + ':00', px, h - 2);
        }

        // Собираем события за 24 часа
        var events = (data.event_log || []).filter(function (e) {
            return e && e.ts >= start && e.ts <= now;
        });

        // Рисуем маркеры
        var points = [];
        events.forEach(function (e) {
            var x = ((e.ts - start) / TTL_MS) * w;
            var color = colorFor(e.type);
            // Размер варьируется в зависимости от свежести
            var freshness = 1 - (now - e.ts) / TTL_MS;
            var radius = 3 + freshness * 3;

            // Свечение
            ctx.beginPath();
            ctx.arc(x, h / 2, radius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = color + '22';
            ctx.fill();

            // Основная точка
            ctx.beginPath();
            ctx.arc(x, h / 2, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            points.push({ x: x, y: h / 2, event: e, radius: radius });
        });

        if (events.length === 0) {
            ctx.fillStyle = 'rgba(168, 138, 72, 0.6)';
            ctx.font = 'italic 12px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('За последние 24 часа событий не было', w / 2, h / 2 + 4);
        }

        canvasData.points = points;
        canvasData.width = w;
        canvasData.height = h;
    }

    // ============================================================
    // 3. Tooltip по hover
    // ============================================================
    function installHover() {
        var canvas = document.getElementById('world-timeline-canvas');
        if (!canvas || canvas.dataset.hoverReady === '1') return;
        canvas.dataset.hoverReady = '1';

        var tooltip = document.getElementById('wt-tooltip');
        if (!tooltip) return;

        canvas.addEventListener('mousemove', function (e) {
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;

            // Ищем ближайшую точку в радиусе 20px
            var best = -1;
            var bestDist = 20;
            for (var i = 0; i < canvasData.points.length; i++) {
                var p = canvasData.points[i];
                var d = Math.hypot(p.x - mx, p.y - my);
                if (d < bestDist) { bestDist = d; best = i; }
            }

            if (best === -1) {
                tooltip.classList.remove('visible');
                hoveredEventIdx = -1;
                canvas.style.cursor = 'default';
                return;
            }

            hoveredEventIdx = best;
            canvas.style.cursor = 'pointer';

            var p = canvasData.points[best];
            var ev = p.event;
            var d2 = new Date(ev.ts);
            var timeStr = pad2(d2.getHours()) + ':' + pad2(d2.getMinutes());

            tooltip.innerHTML =
                '<div><span class="wt-tooltip-icon">' + escapeHtml(ev.icon || '•') + '</span>' +
                escapeHtml(ev.message || '') + '</div>' +
                '<span class="wt-tooltip-time">' + timeStr + '</span>';

            tooltip.classList.add('visible');

            // Позиционируем
            var tipX = Math.min(p.x, canvasData.width - tooltip.offsetWidth - 8);
            tipX = Math.max(8, tipX);
            var tipY = p.y - tooltip.offsetHeight - 10;
            if (tipY < 4) tipY = p.y + 12;

            tooltip.style.left = tipX + 'px';
            tooltip.style.top = tipY + 'px';
        });

        canvas.addEventListener('mouseleave', function () {
            tooltip.classList.remove('visible');
            hoveredEventIdx = -1;
            canvas.style.cursor = 'default';
        });

        canvas.addEventListener('click', function () {
            if (hoveredEventIdx >= 0) {
                // Переключаем на вкладку Хроники
                var chr = document.querySelector('.main-nav .nav-btn[data-tab="chronicles"]');
                if (chr) chr.click();
            }
        });
    }

    // ============================================================
    // 4. Tick
    // ============================================================
    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(render, 250);
            }
        } catch (e) {}
        setTimeout(tick, 2000);
    }

    // ============================================================
    // 5. Boot
    // ============================================================
    function boot() {
        ensureContainer();
        render();
        installHover();

        window.addEventListener('resize', function () {
            if (window.currentData) render();
        }, { passive: true });

        setTimeout(render, 500);
        setTimeout(render, 1500);
        setTimeout(function () {
            ensureContainer();
            installHover();
            render();
        }, 3000);

        tick();
        console.log('[WorldTimeline] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.WorldTimeline = { refresh: render };
})();
