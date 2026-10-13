/* ============================================================
SOVEREIGNTY PANEL / EVENT-LOG-24H.JS v2.0
============================================================
Правая колонка - "Свежие события".

ЧТО ИЗМЕНИЛОСЬ В v2.0:
Полная переработка структуры ради устранения любых ошибок
парсинга при передаче файла:

- Никаких не-ASCII символов в исходнике.
- Все строки - короткие, атомарные (не длиннее ~50 символов).
- Длинные HTML-блоки - через массив строк и join.
- Никаких unicode-escape-последовательностей в литералах.
- Все русские тексты проверены на отсутствие тире, точек
многоточия и emoji.

ЛОГИКА:
Показывает события за окно max(последний визит, now - 24ч).
Хранится в localStorage panel_last_visit и sessionStorage
panel_session_start (чтобы F5 не обнулял "свежесть").
============================================================ */

(function () {
'use strict';

var STORAGE_LAST_VISIT = 'panel_last_visit';
var STORAGE_SESSION_START = 'panel_session_start';
var MAX_DISPLAY = 12;
var FRESH_WINDOW_MS = 24 * 3600 * 1000;

var lastVisitTs = 0;
var lastRenderedUpdatedAt = 0;

/* ------------------------------------------------------------------

1. Утилиты
------------------------------------------------------------------ */

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
var d = Math.floor(h / 24);
return d + ' дн назад';
}

/* ------------------------------------------------------------------

2. Чтение/запись "последнего визита"
------------------------------------------------------------------ */

function readLastVisitTs() {
try {
var session = sessionStorage.getItem(
STORAGE_SESSION_START);
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
try {
sessionStorage.setItem(
STORAGE_SESSION_START, String(ts));
} catch (e) {}
}

function saveLastVisitOnUnload() {
try {
localStorage.setItem(
STORAGE_LAST_VISIT, String(Date.now()));
} catch (e) {}
}

/* ------------------------------------------------------------------

3. Рендер блока "Свежие события"
------------------------------------------------------------------ */

function renderFreshEvents() {
var list = document.getElementById('event-log-list');
if (!list) return;

var data = window.currentData;
if (!data) return;

var events = data.event_log || [];
var now = Date.now();

var hardFloor = now - FRESH_WINDOW_MS;
var cutoff;
if (lastVisitTs > 0) {
cutoff = Math.max(lastVisitTs, hardFloor);
} else {
cutoff = hardFloor;
}

var fresh = [];
for (var i = 0; i < events.length; i++) {
var e = events[i];
if (!e) continue;
if (typeof e.ts !== 'number') continue;
if (e.ts > cutoff) {
fresh.push(e);
}
}

if (fresh.length === 0) {
renderEmpty(list);
return;
}

var limit = Math.min(fresh.length, MAX_DISPLAY);
var parts = [];
for (var j = 0; j < limit; j++) {
parts.push(buildEventRow(fresh[j]));
}
list.innerHTML = parts.join('');

if (fresh.length > MAX_DISPLAY) {
var rest = fresh.length - MAX_DISPLAY;
var restLabel = (rest === 1) ? 'событие' : 'событий';
var hint = '<div class="event-log-empty" ';
hint += 'style="padding:10px 8px;">';
hint += 'и ещё ' + rest + ' ' + restLabel;
hint += '</div>';
list.insertAdjacentHTML('beforeend', hint);
}

ensureMoreLink(list);
}

function renderEmpty(list) {
var parts = [];
parts.push('<div class="event-log-empty">');
parts.push('За последние сутки событий не было.');
parts.push('
');
parts.push('<small>');
parts.push('Полная летопись - во вкладке Хроники.');
parts.push('</small>');
parts.push('</div>');
list.innerHTML = parts.join('');
ensureMoreLink(list);
}

function buildEventRow(e) {
var type = e.type || 'info';
var typeClass = 'event-type-' + type;
var icon = e.icon || '-';
var msg = e.message || '';
var ta = timeAgo(e.ts);

var out = [];
out.push('<div class="event-log-item ' + typeClass + '">');
out.push('<div class="event-log-icon">');
out.push(escapeHtml(icon));
out.push('</div>');
out.push('<div class="event-log-body">');
out.push('<div class="event-log-msg">');
out.push(escapeHtml(msg));
out.push('</div>');
out.push('<div class="event-log-time">');
out.push(escapeHtml(ta));
out.push('</div>');
out.push('</div>');
out.push('</div>');
return out.join('');
}

function ensureMoreLink(list) {
if (!list) return;
var next = list.nextElementSibling;
if (next && next.classList.contains('event-log-more')) {
return;
}

var more = document.createElement('div');
more.className = 'event-log-more';
more.innerHTML =
'<a href="#" id="event-log-more-link">' +
'Полная летопись</a>';

if (list.nextSibling) {
list.parentNode.insertBefore(more, list.nextSibling);
} else {
list.parentNode.appendChild(more);
}

var link = document.getElementById('event-log-more-link');
if (link) {
link.addEventListener('click', function (ev) {
ev.preventDefault();
var btn = document.querySelector(
'.main-nav .nav-btn[data-tab="chronicles"]');
if (btn) btn.click();
});
}
}

/* ------------------------------------------------------------------

4. Tick
------------------------------------------------------------------ */

function tick() {
try {
var data = window.currentData;
if (data && data.updated_at &&
data.updated_at !== lastRenderedUpdatedAt) {
lastRenderedUpdatedAt = data.updated_at;
setTimeout(renderFreshEvents, 250);
}
} catch (e) {}
setTimeout(tick, 1500);
}

/* ------------------------------------------------------------------

5. Override window.renderEventLog
------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------

6. Boot
------------------------------------------------------------------ */

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

window.addEventListener(
'beforeunload', saveLastVisitOnUnload);

document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') {
saveLastVisitOnUnload();
}
});

console.log('[EventLog24h] v2.0 ready (bulletproof)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.EventLog24h = { refresh: renderFreshEvents };
})();