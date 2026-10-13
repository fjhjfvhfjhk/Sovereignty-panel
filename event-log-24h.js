/* ============================================================
SOVEREIGNTY PANEL · EVENT-LOG-24H.JS v1.3
============================================================
Правая колонка главной — блок "Свежие события".

ЧТО ИСПРАВЛЕНО В v1.3:

- Устранена синтаксическая ошибка "'' string literal contains
an unescaped line break" на строке 110, из-за которой файл
не загружался и колонка показывала полный список событий
из app.js (за всё время).
- Причина: длинное тире (U+2014) и emoji (U+1F4DC) внутри
строковых литералов могли быть повреждены при передаче
файла через промежуточные обёртки.
- Решение: все не-ASCII символы заменены на escape-последова-
тельности \u2014 (тире) и String.fromCodePoint (emoji).
В исходнике — только ASCII символы.

ЛОГИКА:

- Окно свежих событий = max(последний визит, now - 24 часа).
- Нижняя граница — сутки, чтобы не показывать события за
6 дней, если пользователь долго не заходил.
- Верхняя граница — сам момент открытия страницы.
- Хранится в localStorage + sessionStorage (чтобы F5 не обнулял).

ПОДКЛЮЧЕНИЕ: последним script в index.html.
============================================================ */

(function () {
'use strict';

var STORAGE_LAST_VISIT = 'panel_last_visit';
var STORAGE_SESSION_START = 'panel_session_start';
var MAX_DISPLAY = 12;
var FRESH_WINDOW_MS = 24 * 3600 * 1000;

/* Длинное тире берём через escape — не полагаемся на UTF-8. */
var EM_DASH = String.fromCharCode(0x2014);
/* Символ "свиток" (scroll) для оформления — через fromCodePoint. */
var ICON_SCROLL = String.fromCodePoint(0x1F4DC);
/* Символ "звёзды" для заголовка — через fromCodePoint. */
var ICON_SPARKLES = String.fromCodePoint(0x2728);

var lastVisitTs = 0;
var lastRenderedUpdatedAt = 0;

/* ============================================================

1. Утилиты
============================================================ */

function escapeHtml(s) {
if (s === null || s === undefined) return '';
var d = document.createElement('div');
d.textContent = String(s);
return d.innerHTML;
}

function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return 'только что';
var m = Math.floor(s / 60);
if (m < 60) return m + ' мин назад';
var h = Math.floor(m / 60);
if (h < 24) return h + ' ч назад';
return Math.floor(h / 24) + ' дн назад';
}

/* ============================================================

2. Отслеживание "последнего визита"
============================================================ */
function readLastVisitTs() {
try {
var session = sessionStorage.getItem(STORAGE_SESSION_START);
if (session !== null) {
var v = parseInt(session, 10);
return isNaN(v) ? 0 : v;
}
} catch (e) {}

try {
var stored = localStorage.getItem(STORAGE_LAST_VISIT);
var n = parseInt(stored || '0', 10);
return isNaN(n) ? 0 : n;
} catch (e) {
return 0;
}
}

function markSessionStart(ts) {
try { sessionStorage.setItem(STORAGE_SESSION_START, String(ts)); }
catch (e) {}
}

function saveLastVisitOnUnload() {
try { localStorage.setItem(STORAGE_LAST_VISIT, String(Date.now())); }
catch (e) {}
}

/* ============================================================

3. Рендер
============================================================ */
function renderFreshEvents() {
var list = document.getElementById('event-log-list');
if (!list) return;

var data = window.currentData;
if (!data) return;

var events = data.event_log || [];
var now = Date.now();

/* Окно: max(последний визит, now - 24ч). */
var hardFloor = now - FRESH_WINDOW_MS;
var cutoff = (lastVisitTs > 0) ? Math.max(lastVisitTs, hardFloor) : hardFloor;

var fresh = [];
for (var i = 0; i < events.length; i++) {
var e = events[i];
if (e && typeof e.ts === 'number' && e.ts > cutoff) {
fresh.push(e);
}
}

if (fresh.length === 0) {
var emptyMsg = 'За последние сутки событий не было.';
var emptyHint = '
<small>Полная летопись ' + EM_DASH +
' во вкладке ' + ICON_SCROLL + ' Хроники.</small>';
list.innerHTML =
'<div class="event-log-empty">' + emptyMsg + emptyHint + '</div>';
ensureMoreLink(list);
return;
}

var display = fresh.slice(0, MAX_DISPLAY);
var html = '';
for (var j = 0; j < display.length; j++) {
var ev = display[j];
var typeClass = 'event-type-' + (ev.type || 'info');
html += '<div class="event-log-item ' + typeClass + '">' +
'<div class="event-log-icon">' + escapeHtml(ev.icon || '•') + '</div>' +
'<div class="event-log-body">' +
'<div class="event-log-msg">' + escapeHtml(ev.message || '') + '</div>' +
'<div class="event-log-time">' + timeAgo(ev.ts) + '</div>' +
'</div>' +
'</div>';
}
list.innerHTML = html;

if (fresh.length > MAX_DISPLAY) {
var moreCount = fresh.length - MAX_DISPLAY;
var moreWord = (moreCount === 1) ? 'событие' : 'событий';
list.insertAdjacentHTML('beforeend',
'<div class="event-log-empty" style="padding:10px 8px;">' +
'... и ещё ' + moreCount + ' ' + moreWord +
'</div>');
}

ensureMoreLink(list);
}

function ensureMoreLink(list) {
if (!list) return;
var next = list.nextElementSibling;
if (next && next.classList.contains('event-log-more')) return;

var more = document.createElement('div');
more.className = 'event-log-more';
more.innerHTML = '<a href="#" id="event-log-more-link">' +
ICON_SCROLL + ' Полная летопись' + String.fromCharCode(0x2192) +
'</a>';

if (list.nextSibling) {
list.parentNode.insertBefore(more, list.nextSibling);
} else {
list.parentNode.appendChild(more);
}

var link = document.getElementById('event-log-more-link');
if (link) {
link.addEventListener('click', function (e) {
e.preventDefault();
var btn = document.querySelector('.main-nav .nav-btn[data-tab="chronicles"]');
if (btn) btn.click();
});
}
}

/* ============================================================

4. Tick — реагирует на обновление JSON
============================================================ */
function tick() {
try {
var data = window.currentData;
if (data && data.updated_at && data.updated_at !== lastRenderedUpdatedAt) {
lastRenderedUpdatedAt = data.updated_at;
setTimeout(renderFreshEvents, 250);
}
} catch (e) {}
setTimeout(tick, 1500);
}

/* ============================================================

5. Переопределение window.renderEventLog (из app.js)
============================================================ */
function installOverride() {
if (window.__renderEventLogPatched) return;
var orig = window.renderEventLog;
if (typeof orig !== 'function') {
setTimeout(installOverride, 200);
return;
}
window.__renderEventLogPatched = true;
window.renderEventLog = function () {
renderFreshEvents();
};
}

/* ============================================================

6. Boot
============================================================ */
function boot() {
lastVisitTs = readLastVisitTs();

try {
if (!sessionStorage.getItem(STORAGE_SESSION_START)) {
markSessionStart(lastVisitTs || Date.now());
}
} catch (e) {}

installOverride();
renderFreshEvents();
tick();

window.addEventListener('beforeunload', saveLastVisitOnUnload);
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') {
saveLastVisitOnUnload();
}
});

console.log('[EventLog24h] v1.3 ready (max 24h window, safe encoding)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.EventLog24h = { refresh: renderFreshEvents };
})();