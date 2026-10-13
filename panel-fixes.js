/* ============================================================
SOVEREIGNTY PANEL · PANEL-FIXES.JS v1.0
============================================================
Модуль-«заплатка» для багов app.js, которые нельзя править
напрямую (правило проекта: app.js не трогаем).

ФИКС v1.0 (13.10.2026):
renderBonus() в app.js ожидает currentData.jackpot как число,
но PanelExporter от RollGame пишет объект {"jackpot": N}.
Результат: `jp > 0` = false → панель джекпота никогда не
показывается, а `formatMoney(объект)` вернул бы "NaN".

Решение: оборачиваем window.renderBonus, разворачиваем
`currentData.jackpot` из объекта в число перед вызовом
оригинала. Работает и с числом, и с объектом.

ПОДКЛЮЧЕНИЕ: сразу после app.js.
     <script src="app.js?v=5.9"></script>     <script src="panel-fixes.js?v=1.0"></script>
============================================================ */
(function () {
'use strict';

var MAX_PATCH_ATTEMPTS = 30;
var PATCH_RETRY_MS = 100;

// ============================================================
// 1. Разворачивание объекта jackpot → число
// ============================================================
function unwrapJackpot() {
var data = window.currentData;
if (!data) return;
var jp = data.jackpot;
if (jp && typeof jp === 'object' && Object.prototype.hasOwnProperty.call(jp, 'jackpot')) {
var n = jp.jackpot;
if (typeof n === 'number' && isFinite(n)) {
data.jackpot = n;
} else if (typeof n === 'string') {
var p = parseFloat(n);
if (isFinite(p)) data.jackpot = p;
}
}
}

// ============================================================
// 2. Патч renderBonus
// ============================================================
function installRenderBonusPatch() {
if (window.__renderBonusPatched) return true;
var orig = window.renderBonus;
if (typeof orig !== 'function') return false;

window.__renderBonusPatched = true;
window.renderBonus = function () {
try { unwrapJackpot(); } catch (e) {}
try {
return orig.apply(this, arguments);
} catch (e) {
console.error('[PanelFixes] renderBonus error:', e);
}
};
return true;
}

// ============================================================
// 3. Дополнительный фикс: War-tracker
//    Если wars[] присутствует, но panel-wars не отрисовался
//    (например, потому что renderBonus падал раньше), активируем
//    вкладку bonus хотя бы для wars.
// ============================================================
function ensureWarsPanel() {
try {
var data = window.currentData;
if (!data) return;
var wp = document.getElementById('panel-wars');
if (!wp) return;
var wars = data.wars || [];
if (wars.length === 0) return;
// Если panel-wars уже видим — всё ок, не трогаем
if (wp.style.display === 'block') return;
wp.style.display = 'block';
var list = document.getElementById('wars-list');
if (list && list.children.length === 0) {
list.innerHTML = wars.map(function (w) {
var attacker = w.attacker || '?';
var defender = w.defender || '?';
var startedAt = w.started_at || 0;
var dateStr = startedAt
? new Date(startedAt).toLocaleDateString('ru-RU',
{ day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
: '—';
return '<div class="war-item"><div>' +
'<div class="name">' +
escapeHtml(attacker) + ' ⚔ ' + escapeHtml(defender) +
'</div>' +
'<div class="desc">С ' + dateStr + '</div>' +
'</div></div>';
}).join('');
}
} catch (e) {}
}

function escapeHtml(s) {
if (s == null) return '';
var d = document.createElement('div');
d.textContent = String(s);
return d.innerHTML;
}

// ============================================================
// 4. Tick — периодически вызываем ensureWarsPanel на случай,
//    если renderBonus так и не поднял этот блок.
// ============================================================
function tickWars() {
ensureWarsPanel();
setTimeout(tickWars, 2000);
}

// ============================================================
// 5. Boot
// ============================================================
function boot() {
var attempts = 0;
function tryPatch() {
attempts++;
if (installRenderBonusPatch()) {
console.log('[PanelFixes] v1.0 ready (jackpot unwrap)');
// После успешного патча — один прогон с уже загруженными данными
try {
if (window.currentData && typeof window.renderBonus === 'function') {
window.renderBonus();
}
} catch (e) {}
return;
}
if (attempts < MAX_PATCH_ATTEMPTS) {
setTimeout(tryPatch, PATCH_RETRY_MS);
} else {
console.warn('[PanelFixes] renderBonus не найден за ' +
MAX_PATCH_ATTEMPTS + ' попыток');
}
}
tryPatch();
tickWars();
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.PanelFixes = {
unwrapJackpot: unwrapJackpot,
refreshWars: ensureWarsPanel
};
})();