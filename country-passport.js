/* ============================================================
SOVEREIGNTY PANEL · COUNTRY-PASSPORT.JS v1.2
============================================================
Модальное окно «Паспорт страны».

ИЗМЕНЕНИЯ v1.2 (13.10.2026):

- ФИКС «паспорт перестал открываться». Причина: два плагина
кликов по карточкам стран (inline onclick="showDetails()"
из country-cards.js и мой capture-listener) конфликтовали,
и в некоторых случаях capture проигрывал inline-обработчику.
Теперь мы ПЕРЕОПРЕДЕЛЯЕМ window.showDetails — это работает
железно, потому что inline onclick всегда ищет showDetails
в window-скоупе в момент клика.
- Capture-listener сохранён как страховка для случая, когда
showDetails был переопределён кем-то ещё.
- v1.1: мини-карта в паспорте не «съезжает» — маркер столицы
🏛️ теперь точно под щитом. Использован <img> с translate
вместо background-position.

ОТКРЫВАЕТСЯ:

- Клик по карточке страны в топе.
- Клик по названию страны в ленте событий.
- Кнопка «📖 Открыть паспорт» в inline-деталях.
- URL параметр ?country=Ник.

ПОДКЛЮЧЕНИЕ: последним <script> в index.html.
============================================================ */
(function () {
'use strict';

var MODAL_ID = 'country-modal';
var CHARGES = ['⚔️', '🛡️', '👑', '🦁', '🦅', '🐉', '⭐', '🌙',
'🔥', '❄️', '🌊', '🌲', '🗡️', '⚓', '🏰', '☀️'];

// ============================================================
// 1. Утилиты
// ============================================================
function escapeHtml(s) {
if (s == null) return '';
var d = document.createElement('div');
d.textContent = String(s);
return d.innerHTML;
}
function escapeAttr(s) {
return s == null ? '' : String(s)
.replace(/&/g, '&').replace(/"/g, '"')
.replace(/'/g, ''').replace(/</g, '<').replace(/>/g, '>');
}
function hashName(name) {
var h = 0;
name = String(name || '?');
for (var i = 0; i < name.length; i++) {
h = ((h << 5) - h) + name.charCodeAt(i);
h |= 0;
}
return Math.abs(h);
}
function formatMoney(a) {
if (a == null) return '0';
var abs = Math.abs(a);
if (abs >= 1000000) return (a / 1000000).toFixed(2) + 'M';
if (abs >= 1000) return (a / 1000).toFixed(1) + 'k';
return Math.round(a).toString();
}
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return 'только что';
var m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
var h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
var d = Math.floor(h / 24); return d + ' дн назад';
}

// ============================================================
// 2. Герб
// ============================================================
function buildCoatOfArms(country) {
var color = country.color || '#6366f1';
var hash = hashName(country.name);
var charge = CHARGES[hash % CHARGES.length];

return '<div class="pp-coa" style="--cc:' + escapeAttr(color) + ';">' +
'<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">' +
'<path d="M 12 7 L 92 7 L 92 62 Q 92 107 52 117 Q 12 107 12 62 Z" ' +
'fill="rgba(0,0,0,0.28)" transform="translate(3,3)"/>' +
'<path d="M 10 5 L 90 5 L 90 60 Q 90 105 50 115 Q 10 105 10 60 Z" ' +
'fill="var(--cc)" stroke="#2A1A0F" stroke-width="2.5"/>' +
'<path d="M 15 10 L 85 10 L 85 58 Q 85 98 50 108 Q 15 98 15 58 Z" ' +
'fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>' +
'<path d="M 18 13 L 82 13 L 82 56 Q 82 95 50 104 Q 18 95 18 56 Z" ' +
'fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>' +
'</svg>' +
'<span class="pp-coa-charge">' + charge + '</span>' +
'</div>';
}

// ============================================================
// 3. Мини-карта (v1.1 fix)
// ============================================================
function buildMiniMap(country) {
var data = window.currentData;
if (!data || !data.map_meta) {
return '<div class="pp-no-map">Метаданные карты недоступны</div>';
}
var meta = data.map_meta;
var cap = country.capital;
if (!cap || cap.chunk_x == null || cap.chunk_z == null) {
return '<div class="pp-no-map">🏛️
Столица не установлена
' +
'<small>Поставь: /c capital set</small></div>';
}

var ppb = (typeof meta.pixels_per_block === 'number' && meta.pixels_per_block > 0)
? meta.pixels_per_block : 1;
var imgW = meta.img_width || 0;
var imgH = meta.img_height || 0;
if (imgW === 0 || imgH === 0) {
return '<div class="pp-no-map">Карта ещё не сгенерирована</div>';
}

var minBlockX = meta.min_chunk_x * 16;
var minBlockZ = meta.min_chunk_z * 16;
var capBlockX = cap.chunk_x * 16 + 8;
var capBlockZ = cap.chunk_z * 16 + 8;

var px = (capBlockX - minBlockX) * ppb;
var pz = (capBlockZ - minBlockZ) * ppb;

var zoom = 2;
var url = 'data/map.png';
if (meta.tiles_version) url += '?v=' + meta.tiles_version;

var styleImg =
'position:absolute;' +
'left:50%;' +
'top:50%;' +
'width:' + (imgW * zoom) + 'px;' +
'height:' + (imgH * zoom) + 'px;' +
'transform:translate(' + (-px * zoom) + 'px, ' + (-pz * zoom) + 'px);' +
'image-rendering:pixelated;' +
'max-width:none;' +
'pointer-events:none;';

return '<div class="pp-map">' +
'<img class="pp-map-img" src="' + escapeAttr(url) + '" ' +
'style="' + styleImg + '" alt="" draggable="false">' +
'<span class="pp-map-capital">🏛️</span>' +
'</div>';
}

// ============================================================
// 4. Граждане
// ============================================================
function buildCitizens(country) {
var data = window.currentData;
if (!data || !data.players) {
return '<div class="pp-chr-empty">Нет данных об игроках</div>';
}

var citizens = data.players.filter(function (p) {
return p.country === country.name;
});

if (citizens.length === 0) {
return '<div class="pp-chr-empty">В стране пока один лидер</div>';
}

citizens.sort(function (a, b) {
var order = { 'leader': 0, 'co_ruler': 1 };
var oa = order[a.country_role] != null ? order[a.country_role] : 2;
var ob = order[b.country_role] != null ? order[b.country_role] : 2;
if (oa !== ob) return oa - ob;
return (b.playtime_seconds || 0) - (a.playtime_seconds || 0);
});

return citizens.map(function (p) {
var name = p.name || '?';
var avatar;
if (window.PanelAvatars && window.PanelAvatars.get) {
avatar = window.PanelAvatars.get(name, 32);
} else {
var letter = name.charAt(0).toUpperCase();
avatar = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
'<rect width="32" height="32" rx="2" fill="' + (country.color || '#6366f1') + '"/>' +
'<text x="16" y="22" text-anchor="middle" font-family="Georgia" ' +
'font-size="17" font-weight="800" fill="white">' + letter + '</text>' +
'</svg>');
}

var roleHtml = '';
if (p.country_role === 'leader') {
roleHtml = '<span class="pp-citizen-role leader">Лидер</span>';
} else if (p.country_role === 'co_ruler') {
roleHtml = '<span class="pp-citizen-role co-ruler">Со-правитель</span>';
} else if (p.online) {
roleHtml = '<span class="pp-citizen-role">● онлайн</span>';
}

return '<div class="pp-citizen" data-pname="' + escapeAttr(name) + '">' +
'<img class="pp-citizen-avatar" src="' + escapeAttr(avatar) + '" ' +
'data-avatar-name="' + escapeAttr(name) + '" alt="">' +
'<span class="pp-citizen-name">' + escapeHtml(name) + '</span>' +
roleHtml +
'</div>';
}).join('');
}

// ============================================================
// 5. Хроника страны
// ============================================================
function buildChronicle(country) {
var data = window.currentData;
if (!data || !data.event_log || data.event_log.length === 0) {
return '<div class="pp-chr-empty">Хроника пуста</div>';
}

var name = country.name;
var relevant = data.event_log.filter(function (e) {
return e.message && e.message.indexOf(name) !== -1;
});

if (relevant.length === 0) {
return '<div class="pp-chr-empty">В хрониках ещё нет упоминаний этой страны</div>';
}

return relevant.slice(0, 8).map(function (e) {
return '<div class="pp-chr-item">' +
'<div class="pp-chr-icon">' + escapeHtml(e.icon || '•') + '</div>' +
'<div class="pp-chr-body">' +
'<div class="pp-chr-msg">' + escapeHtml(e.message || '') + '</div>' +
'<div class="pp-chr-time">' + timeAgo(e.ts) + '</div>' +
'</div>' +
'</div>';
}).join('');
}

// ============================================================
// 6. Полная разметка
// ============================================================
function buildPassportHTML(country) {
var owner = country.owner || '?';
var delta = country.claims_delta_7d || 0;
var deltaHtml = delta > 0
? '<b class="money">+' + delta + '</b>'
: delta < 0
? '<b class="danger">' + delta + '</b>'
: '<b>0</b>';

return '<div class="pp-hero">' +
'<div class="pp-coa-wrap">' + buildCoatOfArms(country) + '</div>' +
'<div class="pp-title-block">' +
'<h2 class="pp-title">' + escapeHtml(country.name) + '</h2>' +
'<div class="pp-subtitle">Лидер: <b>' + escapeHtml(owner) + '</b></div>' +
'<div class="pp-quick-stats">' +
'<span>💰 <b>' + formatMoney(country.bank || 0) + '</b></span>' +
'<span>🗺️ <b>' + (country.claims || 0) + ' / ' + (country.max_claims || '?') + '</b></span>' +
'<span>⚡ <b>' + (country.energy || 0).toFixed(1) + ' / ' + (country.max_energy || 0).toFixed(1) + '</b></span>' +
'</div>' +
'</div>' +
'</div>' +

'<div class="pp-grid">' +
'<section class="pp-section">' +
'<h3 class="pp-section-title">🏛 Территория и столица</h3>' +
buildMiniMap(country) +
'</section>' +
'<section class="pp-section">' +
'<h3 class="pp-section-title">📊 Метрики</h3>' +
'<div class="pp-metrics">' +
metric('Чанков', (country.claims || 0) + ' / ' + (country.max_claims || '?')) +
metric('Казна', formatMoney(country.bank || 0), 'money') +
metric('Долг', formatMoney(country.debt || 0), (country.debt || 0) > 0 ? 'danger' : '') +
metric('Энергия', (country.energy || 0).toFixed(1) + ' / ' + (country.max_energy || 0).toFixed(1), 'warning') +
metric('Регенерация', (country.regen || 0).toFixed(1) + '/ч', 'warning') +
metric('Рост 7д', deltaHtml, '') +
metric('Альянсы', String(country.allies || 0)) +
metric('Пакты', String(country.pacts || 0)) +
metric('Активных войн', String(country.active_wars || 0), (country.active_wars || 0) > 0 ? 'danger' : '') +
metric('Активность', String(country.activity || 0)) +
'</div>' +
'</section>' +
'</div>' +

'<section class="pp-section">' +
'<h3 class="pp-section-title">🏗 Состав территории</h3>' +
'<div class="pp-territory">' +
ttype('🌾 Фермы', country.chunks_farm || 0) +
ttype('⛏ Шахты', country.chunks_mining || 0) +
ttype('⚔ Военные', country.chunks_military || 0) +
ttype('💰 Торговые', country.chunks_trade || 0) +
'</div>' +
'</section>' +

'<section class="pp-section">' +
'<h3 class="pp-section-title">👥 Граждане</h3>' +
'<div class="pp-citizens">' + buildCitizens(country) + '</div>' +
'</section>' +

'<section class="pp-section">' +
'<h3 class="pp-section-title">📜 Хроника страны</h3>' +
'<div class="pp-chronicle">' + buildChronicle(country) + '</div>' +
'</section>' +

'<div class="pp-actions">' +
(country.capital ? '<button class="map-btn pp-action-btn" data-pp-act="capital">🏛 К столице</button>' : '') +
'<button class="map-btn pp-action-btn" data-pp-act="map">🗺 На карте</button>' +
'<button class="map-btn pp-action-btn" data-pp-act="link">🔗 Скопировать ссылку</button>' +
'</div>';
}

function metric(label, value, cls) {
return '<div class="pp-metric"><span>' + escapeHtml(label) + '</span>' +
'<b class="' + (cls || '') + '">' + value + '</b></div>';
}
function ttype(label, value) {
return '<div class="pp-ttype"><span>' + escapeHtml(label) + '</span><b>' + value + '</b></div>';
}

// ============================================================
// 7. Модалка
// ============================================================
function ensureModal() {
var m = document.getElementById(MODAL_ID);
if (m) return m;
m = document.createElement('div');
m.id = MODAL_ID;
m.className = 'modal pp-modal';
m.innerHTML =
'<div class="modal-overlay" data-pp-close></div>' +
'<div class="modal-content pp-modal-content">' +
'<button class="modal-close" data-pp-close aria-label="Закрыть">✕</button>' +
'<div id="pp-body"></div>' +
'</div>';
document.body.appendChild(m);

m.querySelectorAll('[data-pp-close]').forEach(function (el) {
el.addEventListener('click', closeCountryPassport);
});

m.addEventListener('click', function (e) {
var citizen = e.target.closest('.pp-citizen');
if (citizen && citizen.dataset.pname) {
if (typeof window.openPlayer === 'function') {
window.openPlayer(citizen.dataset.pname);
}
}
});

m.addEventListener('click', function (e) {
var btn = e.target.closest('[data-pp-act]');
if (!btn) return;
var act = btn.dataset.ppAct;
var name = m.dataset.country;
if (!name) return;
if (act === 'capital') gotoCountryOnMap(name, true);
else if (act === 'map') gotoCountryOnMap(name, false);
else if (act === 'link') copyLink(name);
});

document.addEventListener('keydown', function (e) {
if (e.key === 'Escape' && m.classList.contains('show')) {
closeCountryPassport();
}
});

return m;
}

// ============================================================
// 8. Публичный API
// ============================================================
function openCountryPassport(countryName) {
var data = window.currentData;
if (!data || !data.countries) {
if (typeof window.showToast === 'function') window.showToast('Данные ещё не загружены');
return;
}
var country = data.countries.filter(function (c) { return c.name === countryName; })[0];
if (!country) {
if (typeof window.showToast === 'function') window.showToast('Страна не найдена: ' + countryName);
return;
}

var m = ensureModal();
m.dataset.country = country.name;
document.getElementById('pp-body').innerHTML = buildPassportHTML(country);
m.classList.add('show');
document.body.style.overflow = 'hidden';

// Скрываем inline-панель деталей страны, если она была открыта —
// чтобы не осталось «фона» от старого клика.
var inline = document.getElementById('country-details');
if (inline) inline.style.display = 'none';

if (window.PanelAvatars && window.PanelAvatars.refresh) {
setTimeout(window.PanelAvatars.refresh, 60);
}
}

function closeCountryPassport() {
var m = document.getElementById(MODAL_ID);
if (!m) return;
m.classList.remove('show');
document.body.style.overflow = '';
}

// ============================================================
// 9. Действия
// ============================================================
function gotoCountryOnMap(countryName, focusCapital) {
var data = window.currentData;
var country = (data.countries || []).filter(function (c) { return c.name === countryName; })[0];
if (!country) return;

var mapBtn = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
if (mapBtn) mapBtn.click();

closeCountryPassport();

setTimeout(function () {
if (!focusCapital || !country.capital) {
if (typeof window.highlightCountry === 'function') {
window.highlightCountry(countryName);
}
return;
}
var meta = data.map_meta;
if (!meta) return;
var cap = country.capital;
var ppb = meta.pixels_per_block || 1;
var minBlockX = meta.min_chunk_x * 16;
var minBlockZ = meta.min_chunk_z * 16;
var px = (cap.chunk_x * 16 + 8 - minBlockX) * ppb;
var pz = (cap.chunk_z * 16 + 8 - minBlockZ) * ppb;
var vp = document.getElementById('map-viewport');
if (!vp) return;
var zoom = 2;
window.mapZoom = zoom;
window.mapOffsetX = vp.clientWidth / 2 - px * zoom;
window.mapOffsetY = vp.clientHeight / 2 - pz * zoom;
if (typeof window.applyMapTransform === 'function') window.applyMapTransform();
if (typeof window.showToast === 'function') {
window.showToast('🏛 Столица: ' + countryName);
}
}, 220);
}

function copyLink(countryName) {
var url = location.origin + location.pathname + '?country=' + encodeURIComponent(countryName);
var done = function (ok) {
if (typeof window.showToast === 'function') {
window.showToast(ok ? '✓ Ссылка скопирована' : '⚠ Не удалось скопировать');
}
};
if (navigator.clipboard && window.isSecureContext) {
navigator.clipboard.writeText(url).then(function () { done(true); })
.catch(function () { done(false); });
} else {
try {
var ta = document.createElement('textarea');
ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
document.body.appendChild(ta); ta.select();
var ok = document.execCommand('copy');
document.body.removeChild(ta);
done(ok);
} catch (e) { done(false); }
}
}

// ============================================================
// 10. v1.2: ПЕРЕОПРЕДЕЛЕНИЕ window.showDetails
// ============================================================
/**

- Самая надёжная точка интеграции.
- 
- Все места, которые вызывают «показать детали страны», используют
- глобальную функцию showDetails():
- - inline onclick="showDetails('X')" в country-cards.js
- - inline onclick="showDetails('X')" в panel-detail.js (override)
- - gotoCountry() в app.js вызывает showDetails() для ленты событий
- 
- Если мы заменим window.showDetails на свой — все эти вызовы
- попадут в openCountryPassport, независимо от порядка и
- фазы всплытия. Никаких capture-конфликтов.
- 
- Также сохраняем оригинал под псевдонимом, чтобы при желании
- вызвать старую inline-панель (например, для отладки).
*/
function installShowDetailsOverride() {
if (window.__showDetailsPatched) return true;

var orig = window.showDetails;
if (typeof orig !== 'function') return false;

window.__showDetailsPatched = true;
window.__showDetailsOriginal = orig;

window.showDetails = function (countryName) {
try {
openCountryPassport(countryName);
} catch (e) {
console.error('[CountryPassport] showDetails override:', e);
// graceful fallback — вызываем оригинал
try { orig.apply(this, arguments); } catch (e2) {}
}
};
return true;
}

// ============================================================
// 11. Capture-listener как страховка
// ============================================================
function installCardOverride() {
document.addEventListener('click', function (e) {
var card = e.target.closest('.ccm-card');
if (!card) return;
var nameEl = card.querySelector('.ccm-name');
if (!nameEl) return;
var name = nameEl.textContent.replace(/🏛️/g, '').trim();
if (!name) return;

// Не трогаем, если клик по вложенному элементу с data-attrs (на будущее)
if (e.target.closest('[data-pp-ignore]')) return;

e.stopImmediatePropagation();
e.preventDefault();
openCountryPassport(name);
}, true);
}

// ============================================================
// 12. Кнопка «Паспорт» в inline-деталях
// ============================================================
function installDetailButton() {
var panel = document.getElementById('country-details');
if (!panel) return;

var mo = new MutationObserver(function () {
setTimeout(addPassportButton, 30);
});
mo.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

setTimeout(addPassportButton, 500);
}

function addPassportButton() {
var panel = document.getElementById('country-details');
if (!panel || panel.style.display === 'none') return;
if (panel.querySelector('.pp-open-btn')) return;

var title = document.getElementById('detail-title');
var content = document.getElementById('detail-content');
if (!title || !content) return;

var name = title.textContent.replace(/🏛️/g, '').replace(/^🏛\s*/, '').trim();
if (!name) return;

var btn = document.createElement('button');
btn.className = 'pp-open-btn map-btn';
btn.type = 'button';
btn.textContent = '📖 Открыть паспорт';
btn.addEventListener('click', function () { openCountryPassport(name); });
content.appendChild(btn);
}

// ============================================================
// 13. URL deep-link ?country=...
// ============================================================
function checkUrlCountry() {
try {
var params = new URLSearchParams(location.search);
var c = params.get('country');
if (!c) return;
var tries = 0;
var iv = setInterval(function () {
tries++;
if (window.currentData && window.currentData.countries
&& window.currentData.countries.length > 0) {
clearInterval(iv);
openCountryPassport(c);
} else if (tries > 30) {
clearInterval(iv);
}
}, 300);
} catch (e) {}
}

// ============================================================
// 14. Boot
// ============================================================
function boot() {
ensureModal();

// v1.2: сначала override showDetails (ждём app.js), потом всё остальное.
var attempts = 0;
function tryPatch() {
attempts++;
if (installShowDetailsOverride()) {
console.log('[CountryPassport] showDetails overridden');
return;
}
if (attempts < 30) setTimeout(tryPatch, 100);
else console.warn('[CountryPassport] showDetails не найден за 3 сек');
}
tryPatch();

installCardOverride();
installDetailButton();
checkUrlCountry();
console.log('[CountryPassport] v1.2 ready');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.openCountryPassport = openCountryPassport;
window.closeCountryPassport = closeCountryPassport;
})();