/* ============================================================
SOVEREIGNTY PANEL · SPARKLINE.JS v1.1
============================================================
График онлайна 24ч в стиле «Antique Atlas».

ИЗМЕНЕНИЯ v1.1 (13.10.2026):

- Полностью переведён на антикварную палитру (пергамент,
латунь, чернила, сургуч, олива) — вместо прежнего тёмного
фона #0a0c12 с индиго-линией, который конфликтовал с
antique-theme.css.
- Шрифт подписей — 'IM Fell English', Georgia, serif.
- Peak-точка — сургучная (wax); current-точка — оливковая.
- Плавно переключается между светлой и тёмной темой через
MutationObserver на [data-theme].
- Публичный API и hover-логика сохранены из v1.0.

ПОДКЛЮЧАТЬ ПОСЛЕ app.js:
     <script src="app.js?v=5.9"></script>     <script src="sparkline.js?v=1.1"></script>
============================================================ */
(function () {
'use strict';

// ============================================================
// 1. Палитры (light / dark — antique)
// ============================================================
function getColors() {
var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
if (isDark) {
return {
bg: '#2A1E10',
grid: 'rgba(201, 168, 96, 0.14)',
gridAcc: 'rgba(201, 168, 96, 0.28)',
line: '#C9A860',
lineGlow: 'rgba(201, 168, 96, 0.45)',
fillTop: 'rgba(201, 168, 96, 0.32)',
fillBot: 'rgba(201, 168, 96, 0.02)',
text: '#A89060',
textHi: '#E8D8B0',
peak: '#D04040',
peakStroke: 'rgba(208, 64, 64, 0.5)',
now: '#7AA048',
nowStroke: 'rgba(122, 160, 72, 0.5)',
hover: 'rgba(201, 168, 96, 0.18)',
tooltipBg: 'rgba(42, 30, 16, 0.98)',
tooltipBorder: 'rgba(201, 168, 96, 0.6)',
tooltipText: '#E8D8B0',
tooltipTextDim: '#A89060'
};
}
return {
bg: '#F4EBD3',
grid: 'rgba(168, 138, 72, 0.22)',
gridAcc: 'rgba(168, 138, 72, 0.35)',
line: '#6E5828',
lineGlow: 'rgba(168, 138, 72, 0.5)',
fillTop: 'rgba(168, 138, 72, 0.38)',
fillBot: 'rgba(168, 138, 72, 0.02)',
text: '#6B5138',
textHi: '#2A1A0F',
peak: '#8B2020',
peakStroke: 'rgba(139, 32, 32, 0.5)',
now: '#52682A',
nowStroke: 'rgba(82, 104, 42, 0.5)',
hover: 'rgba(168, 138, 72, 0.22)',
tooltipBg: 'rgba(244, 235, 211, 0.98)',
tooltipBorder: 'rgba(168, 138, 72, 0.75)',
tooltipText: '#2A1A0F',
tooltipTextDim: '#6B5138'
};
}

var hoverState = { x: -1, y: -1, active: false, idx: -1, points: [], w: 0, h: 0 };

// ============================================================
// 2. Основная функция
// ============================================================
function drawSparkline(history) {
var canvas = document.getElementById('sparkline-canvas');
if (!canvas) return;
var wrap = canvas.parentElement;
if (!wrap) return;

var C = getColors();

var dpr = window.devicePixelRatio || 1;
var W = wrap.clientWidth || 800;
var H = 160;

canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = W + 'px';
canvas.style.height = H + 'px';

var ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// Фон — пергамент (или тёмное дерево)
ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, W, H);

if (!history || history.length < 2) {
ctx.fillStyle = C.text;
ctx.font = "italic 14px 'EB Garamond', Georgia, serif";
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

var padTop = 22;
var padBot = 28;
var n = history.length;
var stepX = (W - 16) / Math.max(1, n - 1);
var chartH = H - padTop - padBot;

var points = [];
for (var j = 0; j < n; j++) {
var it = history[j];
var x = 8 + j * stepX;
var y = H - padBot - (it.count / maxCount) * chartH;
points.push({ x: x, y: y, count: it.count, ts: it.ts });
}

// Горизонтальная сетка + подписи Y
ctx.strokeStyle = C.grid;
ctx.lineWidth = 1;
ctx.font = "10px 'IM Fell English', Georgia, serif";
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
for (var g = 0; g <= 3; g++) {
var gy = padTop + (chartH / 3) * g;
ctx.beginPath();
ctx.moveTo(0, gy);
ctx.lineTo(W, gy);
ctx.stroke();

var val = Math.round(maxCount * (1 - g / 3));
if (val > 0 && g !== 3) {
ctx.fillStyle = C.text;
ctx.fillText(String(val), 6, gy - 6);
}
}

// Вертикальная сетка
var vSteps = 6;
for (var v = 1; v < vSteps; v++) {
var vx = (W / vSteps) * v;
ctx.strokeStyle = C.grid;
ctx.beginPath();
ctx.moveTo(vx, padTop - 4);
ctx.lineTo(vx, H - padBot + 4);
ctx.stroke();
}

// Заливка под линией
var grad = ctx.createLinearGradient(0, padTop, 0, H - padBot);
grad.addColorStop(0, C.fillTop);
grad.addColorStop(1, C.fillBot);

ctx.beginPath();
ctx.moveTo(points[0].x, H - padBot);
for (var k = 0; k < points.length; k++) {
ctx.lineTo(points[k].x, points[k].y);
}
ctx.lineTo(points[points.length - 1].x, H - padBot);
ctx.closePath();
ctx.fillStyle = grad;
ctx.fill();

// Линия с лёгким свечением
ctx.shadowColor = C.lineGlow;
ctx.shadowBlur = 10;
ctx.beginPath();
for (var m = 0; m < points.length; m++) {
if (m === 0) ctx.moveTo(points[m].x, points[m].y);
else ctx.lineTo(points[m].x, points[m].y);
}
ctx.strokeStyle = C.line;
ctx.lineWidth = 2.2;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.stroke();
ctx.shadowBlur = 0;

// Точки данных (только если их немного)
if (points.length <= 60) {
for (var d = 0; d < points.length; d++) {
ctx.beginPath();
ctx.arc(points[d].x, points[d].y, 1.8, 0, Math.PI * 2);
ctx.fillStyle = C.line;
ctx.fill();
}
}

// Peak — сургучная метка
var peakPt = points[peakIdx];
ctx.beginPath();
ctx.arc(peakPt.x, peakPt.y, 5, 0, Math.PI * 2);
ctx.fillStyle = C.peak;
ctx.fill();
ctx.strokeStyle = C.peakStroke;
ctx.lineWidth = 2;
ctx.stroke();

// Current — оливковая метка
var lastPt = points[points.length - 1];
ctx.beginPath();
ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2);
ctx.fillStyle = C.now;
ctx.fill();
ctx.strokeStyle = C.nowStroke;
ctx.lineWidth = 2;
ctx.stroke();

// Внутренняя светлая точка
ctx.beginPath();
ctx.arc(lastPt.x, lastPt.y, 2, 0, Math.PI * 2);
ctx.fillStyle = C.bg;
ctx.fill();

// Подписи
ctx.fillStyle = C.text;
ctx.font = "11px 'IM Fell English', Georgia, serif";
ctx.textBaseline = 'top';
ctx.textAlign = 'right';
ctx.fillText('Пик ' + maxCount, W - 8, 6);

ctx.textBaseline = 'bottom';
ctx.textAlign = 'left';
ctx.fillText('24ч назад', 8, H - 4);
ctx.textAlign = 'right';
ctx.fillText('сейчас', W - 8, H - 4);

hoverState.points = points;
hoverState.w = W;
hoverState.h = H;
hoverState.padTop = padTop;
hoverState.padBot = padBot;

if (hoverState.active) {
drawHoverTooltip(ctx, C);
}
}

/**

- Рисует вертикальную линию + tooltip на canvas при hover.
*/
function drawHoverTooltip(ctx, C) {
var points = hoverState.points;
var W = hoverState.w;
var H = hoverState.h;
var padTop = hoverState.padTop;
var padBot = hoverState.padBot;
var idx = hoverState.idx;

if (idx < 0 || idx >= points.length) return;

var p = points[idx];

ctx.strokeStyle = C.hover;
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(p.x, padTop);
ctx.lineTo(p.x, H - padBot);
ctx.stroke();

ctx.beginPath();
ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
ctx.fillStyle = C.line;
ctx.globalAlpha = 0.3;
ctx.fill();
ctx.globalAlpha = 1;
ctx.beginPath();
ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
ctx.fillStyle = C.textHi;
ctx.fill();

var date = new Date(p.ts);
var timeStr = pad2(date.getHours()) + ':' + pad2(date.getMinutes());
var line1 = 'Онлайн: ' + p.count;
var line2 = 'Время: ' + timeStr;

ctx.font = "12px 'EB Garamond', Georgia, serif";
var tw1 = ctx.measureText(line1).width;
var tw2 = ctx.measureText(line2).width;
var tw = Math.max(tw1, tw2) + 20;
var th = 44;

var tx = p.x + 12;
var ty = p.y - th - 6;
if (tx + tw > W - 4) tx = p.x - tw - 12;
if (ty < 4) ty = p.y + 12;

ctx.fillStyle = C.tooltipBg;
roundRect(ctx, tx, ty, tw, th, 8);
ctx.fill();
ctx.strokeStyle = C.tooltipBorder;
ctx.lineWidth = 1;
roundRect(ctx, tx, ty, tw, th, 8);
ctx.stroke();

ctx.fillStyle = C.tooltipText;
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText(line1, tx + 10, ty + 8);
ctx.fillStyle = C.tooltipTextDim;
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

// ============================================================
// 3. Hover
// ============================================================
function installHover() {
var canvas = document.getElementById('sparkline-canvas');
if (!canvas || canvas.dataset.hover === '1') return;
canvas.dataset.hover = '1';
canvas.style.cursor = 'crosshair';

canvas.addEventListener('mousemove', function (e) {
var rect = canvas.getBoundingClientRect();
var mx = e.clientX - rect.left;

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

hoverState.active = true;
hoverState.idx = bestIdx;
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

var lastHistory = null;
function redrawLastData() {
if (lastHistory) drawSparkline(lastHistory);
}

// ============================================================
// 4. Override window.drawSparkline
// ============================================================
function installOverride() {
if (window.__sparklinePatched) return;
window.__sparklinePatched = true;
window.drawSparkline = function (history) {
lastHistory = history;
drawSparkline(history);
};
}

// ============================================================
// 5. Реакция на resize и смену темы
// ============================================================
function installResize() {
window.addEventListener('resize', debounce(function () {
if (lastHistory) drawSparkline(lastHistory);
}, 200), { passive: true });
}

function installThemeObserver() {
if (!window.MutationObserver) return;
var last = document.documentElement.getAttribute('data-theme');
var obs = new MutationObserver(function () {
var cur = document.documentElement.getAttribute('data-theme');
if (cur !== last) {
last = cur;
if (lastHistory) drawSparkline(lastHistory);
}
});
obs.observe(document.documentElement, {
attributes: true,
attributeFilter: ['data-theme']
});
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
// 6. Boot
// ============================================================
function boot() {
installOverride();
installHover();
installResize();
installThemeObserver();

setTimeout(function () {
if (window.currentData && window.currentData.online_history) {
lastHistory = window.currentData.online_history;
drawSparkline(lastHistory);
}
}, 300);

console.log('[Sparkline] v1.1 ready (antique + theme observer)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}
})();