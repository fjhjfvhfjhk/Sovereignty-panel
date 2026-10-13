/* ============================================================
SOVEREIGNTY PANEL / EVENT-LOG-24H.JS v3.2
============================================================
Правая колонка "Свежие события". DOM-based, ASCII-only source.
Иконки — PanelIcons (SVG), без emoji.
============================================================ */
(function () {
'use strict';

var KEY_LAST = 'panel_last_visit';
var KEY_SESS = 'panel_session_start';
var MAX_DISPLAY = 12;
var WINDOW_MS = 24 * 3600 * 1000;

var lastVisit = 0;
var lastUpdated = 0;

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
Last-visit tracking
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
try { localStorage.setItem(KEY_LAST, String(Date.now())); } catch (e) {}
}

/* ---------------------------------------------------------------
Render
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
var hint = el('div',