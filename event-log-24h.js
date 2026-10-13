/* ============================================================
SOVEREIGNTY PANEL · EVENT-LOG-24H.JS v1.2
============================================================
Правая колонка главной — блок «✨ Свежие события».

ИЗМЕНЕНИЯ v1.2 (13.10.2026):

- ФИКС: если пользователь не заходил давно, в блок попадали
ВСЕ события со дня последнего визита (вплоть до 6 дней).
Теперь окно строго ограничено СНИЗУ 24 часами:
cutoff = max(lastVisitTs, now - 24h)
То есть — «что нового с прошлого визита, но не более чем
за сутки». Это устраняет дубль с таймлайном под графиком
и одновременно даёт осмысленный срез при долгом отсутствии.

ИСТОРИЯ:
v1.0 — фильтр по «24 часа» (дублировало Timeline).
v1.1 — «с прошлого визита», но без верхнего лимита по времени.
v1.2 — «с прошлого визита, но не более 24 ч назад».
============================================================ */
(function () {
'use strict';

var STORAGE_LAST_VISIT = 'panel_last_visit';
var STORAGE_SESSION_START = 'panel_session_start';
var MAX_DISPLAY = 12;
var FRESH_WINDOW_MS = 24 * 3600 * 1000;

var lastVisitTs = 0;
var lastRenderedUpdatedAt = 0;

// ============================================================
// 1. Утилиты
// ============================================================
function escapeHtml(s) {
if (s == null) return '';
var d = document.createElement('div');
d.textContent = String(s);
return d.innerHTML;
}

function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return 'только что';
var m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
var h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
return Math.floor(h / 24) + ' дн назад';
}

// ============================================================
// 2. «Последний визит»
// ============================================================
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
} catch (e) { return 0; }
}

function markSessionStart(ts) {
try { sessionStorage.setItem(STORAGE_SESSION_START, String(ts)); } catch (e) {}
}

function saveLastVisitOnUnload() {
try { localStorage.setItem(STORAGE_LAST_VISIT, String(Date.now())); } catch (e) {}
}

// ============================================================
// 3. Рендер
// ============================================================
function renderFreshEvents() {
var list = document.getElementById('event-log-list');
if (!list) return;

var data = window.currentData;
if (!data) return;

var events = data.event_log || [];
var now = Date.now();

// v1.2: cutoff = max(lastVisit, now - 24h).
// Если пользователь не заходил давно — всё равно смотрим только
// за последние сутки, иначе получим простыню на 6 дней.
var hardFloor = now - FRESH_WINDOW_MS;
var cutoff;
if (lastVisitTs > 0) {
cutoff = Math.max(lastVisitTs, hardFloor);
} else {
// Первый визит — просто показываем последние 24ч.
cutoff = hardFloor;
}

var fresh = events.filter(function (e) {
return e && typeof e.ts === 'number' && e.ts > cutoff;
});

if (fresh.length === 0) {
list.innerHTML =
'<div class="event-log-empty">' +
'За последние сутки событий не было.' +
'
<small>Полная летопись — во вкладке 📜 Хроники.</small>' +
'</div>';
ensureMoreLink(list);
return;
}

var display = fresh.slice(0, MAX_DISPLAY);
list.innerHTML = display.map(function (e) {
var typeClass = 'event-type-' + (e.type || 'info');
return '<div class="event-log-item ' + typeClass + '">' +
'<div class="event-log-icon">' + escapeHtml(e.icon || '•') + '</div>' +
'<div class="event-log-body">' +
'<div class="event-log-msg">' + escapeHtml(e.message || '') + '</div>' +
'<div class="event-log-time">' + timeAgo(e.ts) + '</div>' +
'</div>' +
'</div>';
}).join('');

if (fresh.length > MAX_DISPLAY) {
list.insertAdjacentHTML('beforeend',
'<div class="event-log-empty" style="padding:10px 8px;">' +
'… и ещё ' + (fresh.length - MAX_DISPLAY) + ' событ' +
(fresh.length - MAX_DISPLAY === 1 ? 'ие' : 'ий') +
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
more.innerHTML = '<a href="#" id="event-log-more-link">📜 Полная летопись →</a>';
list.parentNode.insertBefore(more, list.nextSibling);

var link = document.getElementById('event-log-more-link');
if (link) {
link.addEventListener('click', function (e) {
e.preventDefault();
var btn = document.querySelector('.main-nav .nav-btn[data-tab="chronicles"]');
if (btn) btn.click();
});
}
}

// ============================================================
// 4. Tick
// ============================================================
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

// ============================================================
// 5. Override renderEventLog
// ============================================================
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

// ============================================================
// 6. Boot
// ============================================================
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

console.log('[EventLog24h] v1.2 ready (max 24h window)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.EventLog24h = { refresh: renderFreshEvents };
})();