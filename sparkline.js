/* ============================================================
   SOVEREIGNTY PANEL · SPARKLINE.JS v1.0
   ============================================================
   Отдельный модуль графика онлайна 24ч.

   Заменяет drawSparkline из app.js — точнее, переопределяет её
   после того, как app.js загрузился.

   ИСПРАВЛЕНИЕ КРИТИЧЕСКОГО БАГА:
     В оригинальном drawSparkline цикл
         history.forEach(function (h) { ... });
     использует параметр `h`, который ЗАТЕНЯЕТ переменную
     `h = 160` (высоту canvas). Из-за этого координата Y
     становилась NaN, линия не рисовалась.

     Теперь параметр назван `p` (point), а высота `H` — с большой.

   ДОПОЛНИТЕЛЬНО:
     - градиент под линией (фиолетовый → прозрачный),
     - вертикальная сетка с подписями времени,
     - точки на данных (если точек < 60),
     - подсветка peak-точки и текущей точки,
     - hover-тултип с count + временем.

   Подключать ПОСЛЕ app.js:
     <script src="app.js?v=5.9"></script>
     <script src="sparkline.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    var COLORS = {
        line:     '#818cf8',
        lineGlow: 'rgba(129, 140, 248, .5)',
        fillTop:  'rgba(99, 102, 241, .55)',
        fillBot:  'rgba(99, 102, 241, .02)',
        grid:     'rgba(255, 255, 255, .05)',
        gridAcc:  'rgba(99, 102, 241, .12)',
        text:     '#8b91a6',
        textHi:   '#c7d2fe',
        peak:     '#fbbf24',
        now:      '#22c55e',
        bg:       '#0a0c12',
        hover:    'rgba(99, 102, 241, .18)'
    };

    var hoverState = { x: -1, y: -1, active: false, idx: -1, points: [], w: 0, h: 0 };

    /**
     * Основная функция — рисует график онлайна.
     * Переопределяет window.drawSparkline.
     */
    function drawSparkline(history) {
        var canvas = document.getElementById('sparkline-canvas');
        if (!canvas) return;
        var wrap = canvas.parentElement;
        if (!wrap) return;

        var dpr = window.devicePixelRatio || 1;
        var W = wrap.clientWidth || 800;
        var H = 160;

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';

        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Фон
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, W, H);

        if (!history || history.length < 2) {
            ctx.fillStyle = COLORS.text;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Нет данных за 24 часа', W / 2, H / 2);
            setText('online-now', '0');
            setText('online-avg', '0');
            setText('online-peak', '0');
            hoverState.active = false;
            return;
        }

        // Статистика
        var maxCount = 1;
        var sum = 0;
        var peakIdx = 0;
        for (var i = 0; i < history.length; i++) {
            var item = history[i];
            if (item.count > maxCount) { maxCount = item.count; peakIdx = i; }
            sum += item.count;
        }
        var avg = Math.round(sum / history.length);
        var now = history[history.length - 1].count;
        setText('online-now', String(now));
        setText('online-avg', String(avg));
        setText('online-peak', String(maxCount));

        // Точки графика
        var padTop = 22;
        var padBot = 28;
        var n = history.length;
        var stepX = (W - 16) / Math.max(1, n - 1);
        var chartH = H - padTop - padBot;

        // Точки: мапим count → Y (0 внизу, maxCount вверху)
        var points = [];
        for (var j = 0; j < n; j++) {
            var it = history[j];
            var x = 8 + j * stepX;
            var y = H - padBot - (it.count / maxCount) * chartH;
            points.push({ x: x, y: y, count: it.count, ts: it.ts });
        }

        // Сетка — горизонтали
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (var g = 0; g <= 3; g++) {
            var gy = padTop + (chartH / 3) * g;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
            ctx.stroke();
        }

        // Сетка — вертикали каждые ~1/6 ширины
        var vSteps = 6;
        for (var v = 1; v < vSteps; v++) {
            var vx = (W / vSteps) * v;
            ctx.strokeStyle = COLORS.grid;
            ctx.beginPath();
            ctx.moveTo(vx, padTop - 4);
            ctx.lineTo(vx, H - padBot + 4);
            ctx.stroke();
        }

        // Заливка под линией
        var grad = ctx.createLinearGradient(0, padTop, 0, H - padBot);
        grad.addColorStop(0, COLORS.fillTop);
        grad.addColorStop(1, COLORS.fillBot);

        ctx.beginPath();
        ctx.moveTo(points[0].x, H - padBot);
        for (var k = 0; k < points.length; k++) {
            ctx.lineTo(points[k].x, points[k].y);
        }
        ctx.lineTo(points[points.length - 1].x, H - padBot);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Линия с glow
        ctx.shadowColor = COLORS.lineGlow;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (var m = 0; m < points.length; m++) {
            if (m === 0) ctx.moveTo(points[m].x, points[m].y);
            else ctx.lineTo(points[m].x, points[m].y);
        }
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Точки данных (если их не слишком много)
        if (points.length <= 60) {
            for (var d = 0; d < points.length; d++) {
                ctx.beginPath();
                ctx.arc(points[d].x, points[d].y, 2.2, 0, Math.PI * 2);
                ctx.fillStyle = COLORS.line;
                ctx.fill();
            }
        }

        // Peak точка
        var peakPt = points[peakIdx];
        ctx.beginPath();
        ctx.arc(peakPt.x, peakPt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.peak;
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, .4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Текущая точка
        var lastPt = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.now;
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 197, 94, .5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Внутренняя точка (пульсирующая)
        ctx.beginPath();
        ctx.arc(lastPt.x, lastPt.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Подписи
        ctx.fillStyle = COLORS.text;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'right';
        ctx.fillText('Пик ' + maxCount, W - 8, 8);

        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        ctx.fillText('24ч назад', 8, H - 6);
        ctx.textAlign = 'right';
        ctx.fillText('сейчас', W - 8, H - 6);

        // Hover-состояние: сохраняем точки, чтобы на mouseMove перерисовать
        hoverState.points = points;
        hoverState.w = W;
        hoverState.h = H;
        hoverState.padTop = padTop;
        hoverState.padBot = padBot;

        if (hoverState.active) {
            drawHoverTooltip(ctx);
        }
    }

    /**
     * Рисует вертикальную линию + tooltip на canvas.
     * Вызывается при mouseMove по canvas.
     */
    function drawHoverTooltip(ctx) {
        var points = hoverState.points;
        var W = hoverState.w;
        var H = hoverState.h;
        var padTop = hoverState.padTop;
        var padBot = hoverState.padBot;
        var idx = hoverState.idx;

        if (idx < 0 || idx >= points.length) return;

        var p = points[idx];

        // Вертикальная полоса
        ctx.strokeStyle = COLORS.hover;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, padTop);
        ctx.lineTo(p.x, H - padBot);
        ctx.stroke();

        // Хайлайт точки
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.line;
        ctx.globalAlpha = .3;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Тултип
        var date = new Date(p.ts);
        var timeStr = pad2(date.getHours()) + ':' + pad2(date.getMinutes());
        var line1 = 'Онлайн: ' + p.count;
        var line2 = 'Время: ' + timeStr;

        ctx.font = '12px system-ui, sans-serif';
        var tw1 = ctx.measureText(line1).width;
        var tw2 = ctx.measureText(line2).width;
        var tw = Math.max(tw1, tw2) + 20;
        var th = 44;

        var tx = p.x + 12;
        var ty = p.y - th - 6;
        if (tx + tw > W - 4) tx = p.x - tw - 12;
        if (ty < 4) ty = p.y + 12;

        // Плашка
        ctx.fillStyle = 'rgba(15, 17, 23, .95)';
        roundRect(ctx, tx, ty, tw, th, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, .5)';
        ctx.lineWidth = 1;
        roundRect(ctx, tx, ty, tw, th, 8);
        ctx.stroke();

        // Текст
        ctx.fillStyle = COLORS.textHi;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(line1, tx + 10, ty + 8);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(line2, tx + 10, ty + 24);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /**
     * Установка обработчиков hover на canvas.
     */
    function installHover() {
        var canvas = document.getElementById('sparkline-canvas');
        if (!canvas || canvas.dataset.hover === '1') return;
        canvas.dataset.hover = '1';
        canvas.style.cursor = 'crosshair';

        canvas.addEventListener('mousemove', function (e) {
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;

            // Ищем ближайшую точку
            var points = hoverState.points;
            if (!points || points.length === 0) return;
            var bestIdx = -1;
            var bestDist = Infinity;
            for (var i = 0; i < points.length; i++) {
                var d = Math.abs(points[i].x - mx);
                if (d < bestDist) { bestDist = d; bestIdx = i; }
            }
            if (bestDist > 40) {
                if (hoverState.active) {
                    hoverState.active = false;
                    hoverState.idx = -1;
                    redrawLastData();
                }
                return;
            }

            var idxChanged = (bestIdx !== hoverState.idx);
            hoverState.active = true;
            hoverState.idx = bestIdx;
            hoverState.x = mx;
            hoverState.y = my;
            // Перерисовываем полностью — пока проще, чем overlay
            redrawLastData();
        });

        canvas.addEventListener('mouseleave', function () {
            if (hoverState.active) {
                hoverState.active = false;
                hoverState.idx = -1;
                redrawLastData();
            }
        });
    }

    /**
     * Сохранённый последний history, чтобы перерисовывать
     * при hover без повторного fetch.
     */
    var lastHistory = null;
    function redrawLastData() {
        if (lastHistory) drawSparkline(lastHistory);
    }

    /**
     * Установка переопределения window.drawSparkline.
     * Если app.js уже определил функцию — заменяем.
     */
    function installOverride() {
        if (window.__sparklinePatched) return;
        window.__sparklinePatched = true;

        // Своя версия
        window.drawSparkline = function (history) {
            lastHistory = history;
            drawSparkline(history);
        };

        // Перепроверим на повторный вызов из app.js.
        // app.js вызывает window.drawSparkline(...) — попадёт сюда.
    }

    /**
     * Реакция на resize — перерисовываем.
     */
    function installResize() {
        window.addEventListener('resize', debounce(function () {
            if (lastHistory) drawSparkline(lastHistory);
        }, 200), { passive: true });
    }

    function debounce(fn, ms) {
        var t = null;
        return function () {
            var args = arguments, ctx = this;
            if (t) clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    // ============================================================
    // Boot
    // ============================================================

    function boot() {
        installOverride();
        installHover();
        installResize();

        // Если app.js уже успел нарисовать сломанный график —
        // перерисовываем из currentData.
        setTimeout(function () {
            if (window.currentData && window.currentData.online_history) {
                lastHistory = window.currentData.online_history;
                drawSparkline(lastHistory);
            }
        }, 300);

        console.log('[Sparkline] v1.0 ready (fix NaN + hover + gradient)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
