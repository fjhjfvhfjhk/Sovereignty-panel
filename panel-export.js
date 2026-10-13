/* ============================================================
SOVEREIGNTY PANEL · PANEL-EXPORT.JS v1.0
============================================================
Экспорт данных:
• CSV топ стран  — кнопка в панели "🏆 Топ стран"
• PNG карты      — кнопка рядом с картой

Подключение: после country-cards.js и app.js.
============================================================ */
(function () {
'use strict';

var T = {
csvTitle: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0442\u043e\u043f \u0441\u0442\u0440\u0430\u043d \u0432 CSV',
pngTitle: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u043a\u0430\u0440\u0442\u0443 \u043a\u0430\u043a PNG',
noData:   '\u0414\u0430\u043d\u043d\u044b\u0435 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b',
noMap:    '\u041a\u0430\u0440\u0442\u0430 \u0435\u0449\u0451 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u0430',
csvOk:    'CSV \u0441\u043a\u0430\u0447\u0430\u043d',
pngOk:    'PNG \u043a\u0430\u0440\u0442\u044b \u0441\u043a\u0430\u0447\u0430\u043d',
pngErr:   '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0431\u0440\u0430\u0442\u044c PNG'
};

// ============================================================
// Utilities
// ============================================================
function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text != null) n.textContent = text;
return n;
}

function toast(msg) {
if (typeof window.showToast === 'function') window.showToast(msg);
}

function dateStamp() {
var d = new Date();
var y = d.getFullYear();
var m = String(d.getMonth() + 1).padStart(2, '0');
var day = String(d.getDate()).padStart(2, '0');
return y + '-' + m + '-' + day;
}

function downloadBlob(blob, filename) {
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url;
a.download = filename;
a.style.position = 'fixed';
a.style.left = '-9999px';
a.style.top = '-9999px';
document.body.appendChild(a);
a.click();
setTimeout(function () {
if (a.parentNode) a.parentNode.removeChild(a);
URL.revokeObjectURL(url);
}, 200);
}

// ============================================================
// CSV
// ============================================================
function csvField(v) {
if (v == null) return '""';
var s = String(v);
return '"' + s.replace(/"/g, '""') + '"';
}

function buildCsv(data) {
var countries = (data.countries || []).slice();
countries.sort(function (a, b) {
return (b.claims || 0) - (a.claims || 0);
});

var header = [
'#', 'name', 'owner', 'claims', 'max_claims',
'bank', 'debt', 'energy', 'max_energy',
'activity', 'pacts', 'allies'
];

var lines = [];
lines.push(header.join(','));

for (var i = 0; i < countries.length; i++) {
var c = countries[i];
var row = [
i + 1,
csvField(c.name),
csvField(c.owner),
c.claims || 0,
c.max_claims || 0,
Math.round(c.bank || 0),
Math.round(c.debt || 0),
(c.energy || 0).toFixed(1),
(c.max_energy || 0).toFixed(1),
c.activity || 0,
c.pacts || 0,
c.allies || 0
];
lines.push(row.join(','));
}

// BOM \uFEFF — Excel откроет с правильной кодировкой
return '\uFEFF' + lines.join('\r\n');
}

function exportCsv() {
var data = window.currentData;
if (!data) { toast(T.noData); return; }
try {
var csv = buildCsv(data);
var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
downloadBlob(blob, 'countries-' + dateStamp() + '.csv');
toast(T.csvOk);
} catch (e) {
console.error('[Export/Csv]', e);
}
}

// ============================================================
// PNG карты
// ============================================================
function exportMapPng() {
var canvas = document.getElementById('map-canvas');
if (!canvas || !canvas.width || !canvas.height) {
toast(T.noMap);
return;
}
try {
if (typeof canvas.toBlob === 'function') {
canvas.toBlob(function (blob) {
if (!blob) { toast(T.pngErr); return; }
downloadBlob(blob, 'map-' + dateStamp() + '.png');
toast(T.pngOk);
}, 'image/png');
} else {
// Fallback через dataURL
var dataUrl = canvas.toDataURL('image/png');
var a = document.createElement('a');
a.href = dataUrl;
a.download = 'map-' + dateStamp() + '.png';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
toast(T.pngOk);
}
} catch (e) {
console.error('[Export/Png]', e);
toast(T.pngErr);
}
}

// ============================================================
// Install buttons
// ============================================================
function installCsvButton() {
var header = document.getElementById('top-countries-header');
if (!header) return;
if (header.querySelector('#export-csv-btn')) return;

var btn = el('button', 'export-btn');
btn.id = 'export-csv-btn';
btn.type = 'button';
btn.title = T.csvTitle;
btn.textContent = '\u2193 CSV';
btn.addEventListener('click', exportCsv);
header.appendChild(btn);
}

function installPngButton() {
var controls = document.querySelector('.map-controls');
if (!controls) return;
if (controls.querySelector('#export-png-btn')) return;

var btn = el('button', 'map-btn export-btn');
btn.id = 'export-png-btn';
btn.type = 'button';
btn.title = T.pngTitle;
btn.textContent = '\u2193 PNG';
btn.addEventListener('click', exportMapPng);
controls.appendChild(btn);
}

// ============================================================
// Boot
// ============================================================
function boot() {
installCsvButton();
installPngButton();
// Повторные попытки — панель рендерится асинхронно
setTimeout(installCsvButton, 800);
setTimeout(installPngButton, 800);
setTimeout(installCsvButton, 2500);
setTimeout(installPngButton, 2500);
console.log('[PanelExport] v1.0 ready');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.PanelExport = {
csv: exportCsv,
png: exportMapPng
};
})();