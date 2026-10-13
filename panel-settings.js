/* ============================================================
SOVEREIGNTY PANEL · PANEL-SETTINGS.JS v1.0
============================================================
Кнопка-шестерёнка в шапке + модалка настроек.
Все переключатели хранятся в localStorage.

Ключи синхронизированы с mobile.js:
panel_haptics       — '1' (вкл) / '0' (выкл)
panel_pull_refresh  — '1' (вкл) / '0' (выкл)
Новый ключ:
panel_animations    — '1' (вкл, дефолт) / '0' (выкл)

Класс html.no-animations применяется в <head> inline'ом
(чтобы не было вспышки анимаций) и переключается здесь.

Подключение: после theme-switcher.js.
============================================================ */
(function () {
'use strict';

var KEY_ANIM = 'panel_animations';
var KEY_HAP = 'panel_haptics';
var KEY_PTR = 'panel_pull_refresh';

var MODAL_ID = 'panel-settings-modal';

var T = {
title:      '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
close:      '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
haptics:    '\u0412\u0438\u0431\u0440\u0430\u0446\u0438\u044f',
hapticsD:   '\u041e\u0442\u043a\u043b\u0438\u043a \u043f\u0440\u0438 \u043a\u0430\u0441\u0430\u043d\u0438\u0438 (\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0435)',
ptr:        'Pull-to-refresh',
ptrD:       '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u0432\u0430\u0439\u043f\u043e\u043c \u0432\u043d\u0438\u0437',
anim:       '\u0410\u043d\u0438\u043c\u0430\u0446\u0438\u0438',
animD:      '\u0424\u043e\u043d\u043e\u0432\u044b\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u044b \u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u044b',
theme:      '\u0422\u0435\u043c\u0430',
themeAuto:  '\u0410\u0432\u0442\u043e',
themeL:     '\u0421\u0432\u0435\u0442\u043b\u0430\u044f',
themeD:     '\u0422\u0451\u043c\u043d\u0430\u044f',
reset:      '\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u0441\u0451',
resetArm:   '\u0422\u043e\u0447\u043d\u043e?',
okReset:    '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u044b',
okTheme:    '\u0422\u0435\u043c\u0430 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0430'
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

function getBool(key, def) {
try {
var v = localStorage.getItem(key);
if (v === null) return def;
return v !== '0';
} catch (e) { return def; }
}

function setBool(key, val) {
try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) {}
}

function toast(msg) {
if (typeof window.showToast === 'function') window.showToast(msg);
}

// ============================================================
// Animations toggle
// ============================================================
function applyAnimations(enabled) {
var root = document.documentElement;
if (enabled) {
root.classList.remove('no-animations');
} else {
root.classList.add('no-animations');
}
}

// ============================================================
// Row builders
// ============================================================
function buildToggleRow(label, desc, initial, onChange) {
var row = el('div', 'ps-row');

var left = el('div', 'ps-row-left');
left.appendChild(el('div', 'ps-row-title', label));
left.appendChild(el('div', 'ps-row-desc', desc));
row.appendChild(left);

var btn = el('button', 'ps-toggle' + (initial ? ' on' : ''));
btn.type = 'button';
btn.setAttribute('aria-label', label);
btn.appendChild(el('span', 'ps-toggle-knob'));
btn.addEventListener('click', function () {
var newVal = !btn.classList.contains('on');
btn.classList.toggle('on', newVal);
onChange(newVal);
});
row.appendChild(btn);
return row;
}

function buildThemeRow() {
var row = el('div', 'ps-row');

var left = el('div', 'ps-row-left');
left.appendChild(el('div', 'ps-row-title', T.theme));
row.appendChild(left);

var current = 'auto';
if (window.ThemeSwitcher && typeof window.ThemeSwitcher.get === 'function') {
current = window.ThemeSwitcher.get();
}

var seg = el('div', 'ps-seg');
var modes = [
{ key: 'auto',  label: T.themeAuto },
{ key: 'light', label: T.themeL },
{ key: 'dark',  label: T.themeD }
];

modes.forEach(function (m) {
var b = el('button', 'ps-seg-btn' + (m.key === current ? ' active' : ''), m.label);
b.type = 'button';
b.addEventListener('click', function () {
var all = seg.querySelectorAll('.ps-seg-btn');
for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
b.classList.add('active');
if (window.ThemeSwitcher && typeof window.ThemeSwitcher.set === 'function') {
window.ThemeSwitcher.set(m.key);
}
toast(T.okTheme);
});
seg.appendChild(b);
});

row.appendChild(seg);
return row;
}

function buildResetRow() {
var row = el('div', 'ps-footer');
var btn = el('button', 'ps-reset', T.reset);
btn.type = 'button';

var armed = false;
var timer = null;

function disarm() {
armed = false;
btn.textContent = T.reset;
btn.classList.remove('armed');
if (timer) { clearTimeout(timer); timer = null; }
}

btn.addEventListener('click', function () {
if (!armed) {
armed = true;
btn.textContent = T.resetArm;
btn.classList.add('armed');
timer = setTimeout(disarm, 4000);
return;
}
try {
localStorage.removeItem(KEY_ANIM);
localStorage.removeItem(KEY_HAP);
localStorage.removeItem(KEY_PTR);
if (window.ThemeSwitcher && typeof window.ThemeSwitcher.set === 'function') {
window.ThemeSwitcher.set('auto');
}
} catch (e) {}
applyAnimations(true);
disarm();

// пересоздать модалку, чтобы переключатели показали дефолты
var m = document.getElementById(MODAL_ID);
if (m && m.parentNode) m.parentNode.removeChild(m);
openModal();
toast(T.okReset);
});

row.appendChild(btn);
return row;
}

// ============================================================
// Modal
// ============================================================
function buildModal() {
var m = el('div', 'ps-modal');
m.id = MODAL_ID;

var ov = el('div', 'ps-overlay');
ov.addEventListener('click', closeModal);

var content = el('div', 'ps-content');

var header = el('div', 'ps-header');
header.appendChild(el('h2', 'ps-title', T.title));
var closeBtn = el('button', 'ps-close', '\u2715');
closeBtn.type = 'button';
closeBtn.setAttribute('aria-label', T.close);
closeBtn.addEventListener('click', closeModal);
header.appendChild(closeBtn);
content.appendChild(header);

var rows = el('div', 'ps-rows');

rows.appendChild(buildToggleRow(
T.haptics, T.hapticsD,
getBool(KEY_HAP, true),
function (v) { setBool(KEY_HAP, v); }
));

rows.appendChild(buildToggleRow(
T.ptr, T.ptrD,
getBool(KEY_PTR, true),
function (v) { setBool(KEY_PTR, v); }
));

rows.appendChild(buildToggleRow(
T.anim, T.animD,
getBool(KEY_ANIM, true),
function (v) {
setBool(KEY_ANIM, v);
applyAnimations(v);
}
));

rows.appendChild(buildThemeRow());
content.appendChild(rows);
content.appendChild(buildResetRow());

m.appendChild(ov);
m.appendChild(content);
return m;
}

function ensureModal() {
var m = document.getElementById(MODAL_ID);
if (m) return m;
m = buildModal();
document.body.appendChild(m);
document.addEventListener('keydown', function (e) {
if (e.key === 'Escape' && m.classList.contains('show')) closeModal();
});
return m;
}

function openModal() {
ensureModal();
var m = document.getElementById(MODAL_ID);
if (m) m.classList.add('show');
}

function closeModal() {
var m = document.getElementById(MODAL_ID);
if (m) m.classList.remove('show');
}

// ============================================================
// Gear button
// ============================================================
function installGearButton() {
var btn = document.getElementById('panel-settings-btn');
if (!btn) return;
btn.addEventListener('click', function (e) {
e.preventDefault();
openModal();
});
}

// ============================================================
// Boot
// ============================================================
function boot() {
// Досыпаем класс, если inline в head по какой-то причине
// не применил его (к примеру, пользователь включил в settings
// без перезагрузки — тогда уже навешано, ничего не делаем).
applyAnimations(getBool(KEY_ANIM, true));
installGearButton();
console.log('[PanelSettings] v1.0 ready');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.PanelSettings = {
open: openModal,
close: closeModal
};
})();