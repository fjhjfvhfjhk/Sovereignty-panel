/* ============================================================
SOVEREIGNTY PANEL · EVENT-LOG-24H.JS v1.1
============================================================
Блок «✨ Свежие события» в правой колонке главной страницы.

ИСТОРИЯ:
v1.0 — показывал события за 24 часа, что ДУБЛИРОВАЛО
«Летопись 24 часов» (timeline под графиком онлайна).
v1.1 — репурпоз: показывает только события, произошедшие
С ПРОШЛОГО ВИЗИТА игрока. Полностью отличается от
timeline'а — тот визуальный за 24ч, этот текстовый
«что нового с тех пор, как ты последний раз заходил».

ЛОГИКА «прошлого визита»:

- localStorage.panel_last_visit — timestamp последнего закрытия.
- sessionStorage.panel_session_start — timestamp начала текущей
сессии (tab). Нужен, чтобы F5 НЕ обнулял «свежесть».
- На unload → обновляем localStorage.
- При открытии: если sessionStorage пуст → читаем из
localStorage. Иначе — используем то, что было в начале сессии.
============================================================ */
(function () {
'use strict';

var STORAGE_LAST_VISIT = 'panel_last_visit';
var STORAGE_SESSION_START = 'panel_session_start';
var MAX_DISPLAY = 15;

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
// 2. Чтение/запись «последнего визита»
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

// Фильтр «свежие с прошлого визита».
// Если lastVisitTs == 0 (первый визит) — показываем последние 5
// событий из тех, что есть.
var fresh;
if (lastVisitTs > 0) {
fresh = events.filter(function (e) {
return e && typeof e.ts === 'number' && e.ts > lastVisitTs;
});
} else {
fresh = events.slice(0, 5);
}

if (fresh.length === 0) {
list.innerHTML =
'<div class="event-log-empty">' +
'С прошлого визита ничего не произошло.' +
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

// Если в блоке есть скрытые события — подскажем
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
// 4. Tick — реагирует на обновление JSON
// ============================================================
function tick() {
try {
var data = window.currentData;
if (data && data.updated_at && data.updated_at !== lastRenderedUpdatedAt) {
lastRenderedUpdatedAt = data.updated_at;
// Небольшая задержка, чтобы app.js успел отработать safeRender
setTimeout(renderFreshEvents, 250);
}
} catch (e) {}
setTimeout(tick, 1500);
}

// ============================================================
// 5. Override renderEventLog (app.js) — чтобы на каждой перерисовке
//    мы сразу показывали свой отфильтрованный список, а не мелькали
//    «все 20 подряд».
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
// Фиксируем «начало сессии» только если его ещё нет
// (т.е. это первая загрузка в этой вкладке).
try {
if (!sessionStorage.getItem(STORAGE_SESSION_START)) {
markSessionStart(lastVisitTs || Date.now());
}
} catch (e) {}

installOverride();
renderFreshEvents();
tick();

// Обновляем «последний визит» при закрытии/уходе со страницы
window.addEventListener('beforeunload', saveLastVisitOnUnload);
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') {
saveLastVisitOnUnload();
}
});

console.log('[EventLog24h] v1.1 ready (fresh-since-last-visit)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.EventLog24h = { refresh: renderFreshEvents };
})();