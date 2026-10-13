/* SOVEREIGNTY PANEL - event-log-24h.js v3.1
DOM-based, ASCII-only source.
Full design: right column "fresh events" with icons + styles.
*/
(function () {
'use strict';

var KEY_LAST = 'panel_last_visit';
var KEY_SESS = 'panel_session_start';
var MAX_DISPLAY = 12;
var WINDOW_MS = 24 * 3600 * 1000;

var lastVisit = 0;
var lastUpdated = 0;

/* ASCII-only localized strings via \u escapes */
var T = {
empty:   '\u0417\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0441\u0443\u0442\u043a\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043d\u0435 \u0431\u044b\u043b\u043e.',
more:    '\u041f\u043e\u043b\u043d\u0430\u044f \u043b\u0435\u0442\u043e\u043f\u0438\u0441\u044c',
moreHint:'\u041f\u043e\u043b\u043d\u0430\u044f \u043b\u0435\u0442\u043e\u043f\u0438\u0441\u044c - \u0432\u043e \u0432\u043a\u043b\u0430\u0434\u043a\u0435 \u0425\u0440\u043e\u043d\u0438\u043a\u0438.',
andMore: '\u0438 \u0435\u0449\u0451 ',
ev1:     '\u0441\u043e\u0431\u044b\u0442\u0438\u0435',
evN:     '\u0441\u043e\u0431\u044b\u0442\u0438\u0439',
ta_now:  '\u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e',
ta_m:    ' \u043c\u0438\u043d',
ta_h:    ' \u0447',
ta_d:    ' \u0434\u043d'
};

var E_SCROLL = String.fromCodePoint(0x1F4DC);
var ARROW = String.fromCharCode(0x2192);

/* ---------------------------------------------------------------

1. Utils
--------------------------------------------------------------- */

function txt(s) { return s == null ? '' : String(s); }

function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text != null) n.textContent = text;
return n;
}

function clear(node) {
while (node.firstChild) node.removeChild(node.firstChild);
}

function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return T.ta_now;
var m = Math.floor(s / 60); if (m < 60) return m + T.ta_m;
var h = Math.floor(m / 60); if (h < 24) return h + T.ta_h;
return Math.floor(h / 24) + T.ta_d;
}

/* ---------------------------------------------------------------

2. Last-visit tracking
--------------------------------------------------------------- */

function readLast() {
try {
var v = sessionStorage.getItem(KEY_SESS);
if (v !== null) {
var n = parseInt(v, 10);
return isNaN(n) ? 0 : n;
}
} catch (e) {}
try {
var s = localStorage.getItem(KEY_LAST);
var p = parseInt(s || '0', 10);
return isNaN(p) ? 0 : p;
} catch (e) { return 0; }
}

function saveLast() {
try {
localStorage.setItem(KEY_LAST, String(Date.now()));
} catch (e) {}
}

/* ---------------------------------------------------------------

3. Render
--------------------------------------------------------------- */

function render() {
var list = document.getElementById('event-log-list');
if (!list) return;

var data = window.currentData;
if (!data) return;

var events = data.event_log || [];
var now = Date.now();
var floor = now - WINDOW_MS;
var cutoff = lastVisit > 0 ? Math.max(lastVisit, floor) : floor;

var fresh = [];
for (var i = 0; i < events.length; i++) {
var e = events[i];
if (e && typeof e.ts === 'number' && e.ts > cutoff) {
fresh.push(e);
}
}

clear(list);

if (fresh.length === 0) {
renderEmpty(list);
ensureMoreLink(list);
return;
}

var limit = Math.min(fresh.length, MAX_DISPLAY);
for (var j = 0; j < limit; j++) {
list.appendChild(buildRow(fresh[j]));
}

if (fresh.length > MAX_DISPLAY) {
var rest = fresh.length - MAX_DISPLAY;
var label = rest === 1 ? T.ev1 : T.evN;
var hint = el('div', 'event-log-empty', T.andMore + rest + ' ' + label);
hint.style.padding = '10px 8px';
list.appendChild(hint);
}

ensureMoreLink(list);
}

function renderEmpty(list) {
var box = el('div', 'event-log-empty');
box.appendChild(document.createTextNode(T.empty));
box.appendChild(document.createElement('br'));
var small = el('small', null, T.moreHint);
box.appendChild(small);
list.appendChild(box);
}

function buildRow(e) {
var typeClass = 'event-log-item event-type-' + (e.type || 'info');
var row = el('div', typeClass);
row.appendChild(el('div', 'event-log-icon', txt(e.icon || '\u2022')));

var body = el('div', 'event-log-body');
body.appendChild(el('div', 'event-log-msg', txt(e.message)));
body.appendChild(el('div', 'event-log-time', timeAgo(e.ts)));
row.appendChild(body);
return row;
}

function ensureMoreLink(list) {
if (!list) return;
var next = list.nextElementSibling;
if (next && next.classList.contains('event-log-more')) return;

var wrap = el('div', 'event-log-more');
var a = document.createElement('a');
a.href = '#';
a.id = 'event-log-more-link';
a.textContent = E_SCROLL + ' ' + T.more + ' ' + ARROW;
wrap.appendChild(a);

if (list.nextSibling) {
list.parentNode.insertBefore(wrap, list.nextSibling);
} else {
list.parentNode.appendChild(wrap);
}

a.addEventListener('click', function (ev) {
ev.preventDefault();
var btn = document.querySelector(
'.main-nav .nav-btn[data-tab="chronicles"]');
if (btn) btn.click();
});
}

/* ---------------------------------------------------------------

4. Tick
--------------------------------------------------------------- */

function tick() {
try {
var d = window.currentData;
if (d && d.updated_at && d.updated_at !== lastUpdated) {
lastUpdated = d.updated_at;
setTimeout(render, 250);
}
} catch (e) {}
setTimeout(tick, 1500);
}

/* ---------------------------------------------------------------

5. Override renderEventLog from app.js
--------------------------------------------------------------- */

function installOverride() {
if (window.__renderEventLogPatched) return true;
var orig = window.renderEventLog;
if (typeof orig !== 'function') return false;
window.__renderEventLogPatched = true;
window.renderEventLog = function () { render(); };
return true;
}

/* ---------------------------------------------------------------

6. Boot
--------------------------------------------------------------- */

function boot() {
lastVisit = readLast();

try {
if (!sessionStorage.getItem(KEY_SESS)) {
sessionStorage.setItem(KEY_SESS, String(lastVisit || Date.now()));
}
} catch (e) {}

var tries = 0;
function tryPatch() {
tries++;
if (installOverride()) {
console.log('[EventLog24h] v3.1 ready');
return;
}
if (tries < 50) setTimeout(tryPatch, 100);
}
tryPatch();

render();
tick();

window.addEventListener('beforeunload', saveLast);
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') saveLast();
});
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.EventLog24h = { refresh: render };

})();