/* SOVEREIGNTY PANEL - event-log-24h.js v3.0
Minimal, DOM-based, ASCII-only.
Right column: fresh events (max 24h window).
*/
(function () {
'use strict';

var KEY_LAST = 'panel_last_visit';
var KEY_SESS = 'panel_session_start';
var MAX = 12;
var WINDOW = 24 * 3600 * 1000;

var lastVisit = 0;
var lastUpdated = 0;

function txt(s) { return s == null ? '' : String(s); }

function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return 'now';
var m = Math.floor(s / 60); if (m < 60) return m + 'm';
var h = Math.floor(m / 60); if (h < 24) return h + 'h';
return Math.floor(h / 24) + 'd';
}

function readLast() {
try {
var v = sessionStorage.getItem(KEY_SESS);
if (v !== null) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
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

function render() {
var list = document.getElementById('event-log-list');
if (!list) return;
var d = window.currentData;
if (!d) return;

var events = d.event_log || [];
var now = Date.now();
var floor = now - WINDOW;
var cutoff = lastVisit > 0 ? Math.max(lastVisit, floor) : floor;

var fresh = [];
for (var i = 0; i < events.length; i++) {
var e = events[i];
if (e && typeof e.ts === 'number' && e.ts > cutoff) fresh.push(e);
}

list.textContent = '';

if (fresh.length === 0) {
var empty = document.createElement('div');
empty.className = 'event-log-empty';
empty.textContent = 'No events in last 24h';
list.appendChild(empty);
return;
}

var limit = Math.min(fresh.length, MAX);
for (var j = 0; j < limit; j++) {
var ev = fresh[j];
var item = document.createElement('div');
item.className = 'event-log-item event-type-' + (ev.type || 'info');

var icon = document.createElement('div');
icon.className = 'event-log-icon';
icon.textContent = txt(ev.icon || '-');

var body = document.createElement('div');
body.className = 'event-log-body';

var msg = document.createElement('div');
msg.className = 'event-log-msg';
msg.textContent = txt(ev.message);

var time = document.createElement('div');
time.className = 'event-log-time';
time.textContent = timeAgo(ev.ts);

body.appendChild(msg);
body.appendChild(time);
item.appendChild(icon);
item.appendChild(body);
list.appendChild(item);
}

console.log('[EventLog24h] v3.0 ready, rendered ' + limit + ' events');
}

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

/* override window.renderEventLog from app.js */
function installOverride() {
if (window.__renderEventLogPatched) return true;
var orig = window.renderEventLog;
if (typeof orig !== 'function') return false;
window.__renderEventLogPatched = true;
window.renderEventLog = function () { render(); };
return true;
}

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
if (!installOverride() && tries < 50) setTimeout(tryPatch, 100);
}
tryPatch();

render();
tick();

window.addEventListener('beforeunload', saveLast);
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') saveLast();
});

console.log('[EventLog24h] v3.0 init');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.EventLog24h = { refresh: render };

})();