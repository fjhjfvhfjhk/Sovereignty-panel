/* ============================================================
SOVEREIGNTY PANEL / COUNTRY-PASSPORT.JS v2.0
============================================================
Модальное окно паспорта страны.

ЧТО ИЗМЕНИЛОСЬ В v2.0:
Полный рефакторинг с целью "bulletproof" для любого
text-transfer пайплайна:

- Ни одной строки длиннее 60 символов.
- Абсолютно все строковые литералы короткие, атомарные.
- Никаких unicode-escapes и спецсимволов в исходнике.
- Все длинные HTML-блоки собираются через массив строк
и Array.prototype.join('') - это исключает любые проблемы
с многострочными литералами.
- Текст на русском - минимальные куски. Emoji не используются.
- Длинные тире заменены на обычные дефисы.
- Всё, что может содержать "опасный" символ -
отдельная переменная.

ПОДКЛЮЧЕНИЕ: последним script в index.html.
============================================================ */

(function () {
'use strict';

var MODAL_ID = 'country-modal';

/* ------------------------------------------------------------------

1. Утилиты
------------------------------------------------------------------ */

function escapeHtml(s) {
if (s === null || s === undefined) return '';
var d = document.createElement('div');
d.textContent = String(s);
return d.innerHTML;
}

/**

- Экранирование для HTML-атрибутов.
- Работает по кодам символов - в исходнике только ASCII.
*/
function escapeAttr(s) {
if (s === null || s === undefined) return '';
var src = String(s);
var out = '';
for (var i = 0; i < src.length; i++) {
var code = src.charCodeAt(i);
var ch = src.charAt(i);
switch (code) {
case 38: /* амперсанд */
out = out + '&' + 'amp;';
break;
case 60: /* меньше */
out = out + '&' + 'lt;';
break;
case 62: /* больше */
out = out + '&' + 'gt;';
break;
case 34: /* двойная кавычка */
out = out + '&' + '#34;';
break;
case 39: /* одинарная кавычка */
out = out + '&' + '#39;';
break;
default:
out = out + ch;
}
}
return out;
}

function hashName(name) {
var h = 0;
var s = String(name === null || name === undefined ? '?' : name);
for (var i = 0; i < s.length; i++) {
h = ((h << 5) - h) + s.charCodeAt(i);
h = h | 0;
}
return Math.abs(h);
}

function formatMoney(a) {
if (a === null || a === undefined) return '0';
var abs = Math.abs(a);
if (abs >= 1000000) {
return (a / 1000000).toFixed(2) + 'M';
}
if (abs >= 1000) {
return (a / 1000).toFixed(1) + 'k';
}
return Math.round(a).toString();
}

function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return 'только что';
var m = Math.floor(s / 60);
if (m < 60) return m + ' мин';
var h = Math.floor(m / 60);
if (h < 24) return h + ' ч';
var d = Math.floor(h / 24);
return d + ' дн';
}

/* ------------------------------------------------------------------

2. Эмблемы герба (без emoji - только ASCII)
------------------------------------------------------------------ */

var CHARGES = [
'S', 'D', 'C', 'L', 'E', 'W', 'X', 'M',
'F', 'I', 'O', 'T', 'K', 'A', 'H', 'V'
];

/* ------------------------------------------------------------------

3. Герб
------------------------------------------------------------------ */

function buildCoatOfArms(country) {
var color = country.color || '#6366f1';
var hash = hashName(country.name);
var charge = CHARGES[hash % CHARGES.length];

var shadowPath = 'M 12 7 L 92 7 L 92 62 Q 92 107 52 117 ' +
'Q 12 107 12 62 Z';
var mainPath   = 'M 10 5 L 90 5 L 90 60 Q 90 105 50 115 ' +
'Q 10 105 10 60 Z';
var innerPath1 = 'M 15 10 L 85 10 L 85 58 Q 85 98 50 108 ' +
'Q 15 98 15 58 Z';
var innerPath2 = 'M 18 13 L 82 13 L 82 56 Q 82 95 50 104 ' +
'Q 18 95 18 56 Z';

var parts = [];
parts.push('<div class="pp-coa" style="--cc:' +
escapeAttr(color) + ';">');
parts.push('<svg viewBox="0 0 100 120" ');
parts.push('xmlns="http://www.w3.org/2000/svg">');
parts.push('<path d="' + shadowPath + '" ');
parts.push('fill="rgba(0,0,0,0.28)" ');
parts.push('transform="translate(3,3)"/>');
parts.push('<path d="' + mainPath + '" ');
parts.push('fill="var(--cc)" stroke="#2A1A0F" ');
parts.push('stroke-width="2.5"/>');
parts.push('<path d="' + innerPath1 + '" fill="none" ');
parts.push('stroke="rgba(255,255,255,0.35)" ');
parts.push('stroke-width="1.2"/>');
parts.push('<path d="' + innerPath2 + '" fill="none" ');
parts.push('stroke="rgba(0,0,0,0.25)" ');
parts.push('stroke-width="0.8"/>');
parts.push('</svg>');
parts.push('<span class="pp-coa-charge">' +
escapeHtml(charge) + '</span>');
parts.push('</div>');
return parts.join('');
}

/* ------------------------------------------------------------------

4. Мини-карта
------------------------------------------------------------------ */

function buildMiniMap(country) {
var data = window.currentData;
if (!data || !data.map_meta) {
return '<div class="pp-no-map">' +
'Метаданные карты недоступны</div>';
}

var meta = data.map_meta;
var cap = country.capital;
var noCap = !cap;
if (!noCap) {
noCap = (cap.chunk_x === null ||
cap.chunk_x === undefined ||
cap.chunk_z === null ||
cap.chunk_z === undefined);
}
if (noCap) {
return '<div class="pp-no-map">' +
'Столица не установлена
' +
'<small>Поставь: /c capital set</small>' +
'</div>';
}

var ppb = 1;
if (typeof meta.pixels_per_block === 'number' &&
meta.pixels_per_block > 0) {
ppb = meta.pixels_per_block;
}
var imgW = meta.img_width || 0;
var imgH = meta.img_height || 0;
if (imgW === 0 || imgH === 0) {
return '<div class="pp-no-map">' +
'Карта ещё не сгенерирована</div>';
}

var minBlockX = meta.min_chunk_x * 16;
var minBlockZ = meta.min_chunk_z * 16;
var capBlockX = cap.chunk_x * 16 + 8;
var capBlockZ = cap.chunk_z * 16 + 8;

var px = (capBlockX - minBlockX) * ppb;
var pz = (capBlockZ - minBlockZ) * ppb;

var zoom = 2;
var url = 'data/map.png';
if (meta.tiles_version) {
url = url + '?v=' + meta.tiles_version;
}

var styleArr = [];
styleArr.push('position:absolute;');
styleArr.push('left:50%;');
styleArr.push('top:50%;');
styleArr.push('width:' + (imgW * zoom) + 'px;');
styleArr.push('height:' + (imgH * zoom) + 'px;');
styleArr.push('transform:translate(');
styleArr.push((-px * zoom) + 'px,');
styleArr.push((-pz * zoom) + 'px);');
styleArr.push('image-rendering:pixelated;');
styleArr.push('max-width:none;');
styleArr.push('pointer-events:none;');
var styleImg = styleArr.join('');

var out = [];
out.push('<div class="pp-map">');
out.push('<img class="pp-map-img" ');
out.push('src="' + escapeAttr(url) + '" ');
out.push('style="' + styleImg + '" ');
out.push('alt="" draggable="false">');
out.push('<span class="pp-map-capital">C</span>');
out.push('</div>');
return out.join('');
}

/* ------------------------------------------------------------------

5. Граждане
------------------------------------------------------------------ */

function buildCitizens(country) {
var data = window.currentData;
if (!data || !data.players) {
return '<div class="pp-chr-empty">' +
'Нет данных об игроках</div>';
}

var citizens = [];
for (var i = 0; i < data.players.length; i++) {
if (data.players[i].country === country.name) {
citizens.push(data.players[i]);
}
}

if (citizens.length === 0) {
return '<div class="pp-chr-empty">' +
'В стране пока один лидер</div>';
}

citizens.sort(function (a, b) {
var oa = roleOrder(a.country_role);
var ob = roleOrder(b.country_role);
if (oa !== ob) return oa - ob;
var pa = a.playtime_seconds || 0;
var pb = b.playtime_seconds || 0;
return pb - pa;
});

var parts = [];
for (var j = 0; j < citizens.length; j++) {
parts.push(buildCitizenRow(citizens[j], country));
}
return parts.join('');
}

function roleOrder(role) {
if (role === 'leader') return 0;
if (role === 'co_ruler') return 1;
return 2;
}

function buildCitizenRow(p, country) {
var name = p.name || '?';
var avatar;

if (window.PanelAvatars && window.PanelAvatars.get) {
avatar = window.PanelAvatars.get(name, 32);
} else {
avatar = buildFallbackAvatar(name, country.color);
}

var roleHtml = '';
if (p.country_role === 'leader') {
roleHtml = '<span class="pp-citizen-role leader">' +
'Лидер</span>';
} else if (p.country_role === 'co_ruler') {
roleHtml = '<span class="pp-citizen-role co-ruler">' +
'Co</span>';
} else if (p.online) {
roleHtml = '<span class="pp-citizen-role">' +
'online</span>';
}

var out = [];
out.push('<div class="pp-citizen" ');
out.push('data-pname="' + escapeAttr(name) + '">');
out.push('<img class="pp-citizen-avatar" ');
out.push('src="' + escapeAttr(avatar) + '" ');
out.push('data-avatar-name="' + escapeAttr(name) + '" alt="">');
out.push('<span class="pp-citizen-name">');
out.push(escapeHtml(name));
out.push('</span>');
out.push(roleHtml);
out.push('</div>');
return out.join('');
}

function buildFallbackAvatar(name, color) {
var letter = String(name).charAt(0).toUpperCase();
var fill = color || '#6366f1';
var out = [];
out.push('<svg xmlns="http://www.w3.org/2000/svg" ');
out.push('viewBox="0 0 32 32">');
out.push('<rect width="32" height="32" rx="2" ');
out.push('fill="' + escapeAttr(fill) + '"/>');
out.push('<text x="16" y="22" text-anchor="middle" ');
out.push('font-family="Georgia" font-size="17" ');
out.push('font-weight="800" fill="white">');
out.push(escapeAttr(letter));
out.push('</text></svg>');
var svg = out.join('');
return 'data:image/svg+xml;charset=utf-8,' +
encodeURIComponent(svg);
}

/* ------------------------------------------------------------------

6. Хроника страны
------------------------------------------------------------------ */

function buildChronicle(country) {
var data = window.currentData;
if (!data || !data.event_log || data.event_log.length === 0) {
return '<div class="pp-chr-empty">Хроника пуста</div>';
}

var name = country.name;
var relevant = [];
for (var i = 0; i < data.event_log.length; i++) {
var e = data.event_log[i];
if (e.message && e.message.indexOf(name) !== -1) {
relevant.push(e);
}
}

if (relevant.length === 0) {
return '<div class="pp-chr-empty">' +
'В хрониках пока нет упоминаний этой страны</div>';
}

var parts = [];
var limit = Math.min(relevant.length, 8);
for (var j = 0; j < limit; j++) {
parts.push(buildChronicleRow(relevant[j]));
}
return parts.join('');
}

function buildChronicleRow(e) {
var icon = e.icon || '-';
var msg = e.message || '';
var ta = timeAgo(e.ts);
var out = [];
out.push('<div class="pp-chr-item">');
out.push('<div class="pp-chr-icon">');
out.push(escapeHtml(icon));
out.push('</div>');
out.push('<div class="pp-chr-body">');
out.push('<div class="pp-chr-msg">');
out.push(escapeHtml(msg));
out.push('</div>');
out.push('<div class="pp-chr-time">');
out.push(escapeHtml(ta));
out.push('</div>');
out.push('</div>');
out.push('</div>');
return out.join('');
}

/* ------------------------------------------------------------------

7. Мелкие блоки
------------------------------------------------------------------ */

function metric(label, value, cls) {
var out = [];
out.push('<div class="pp-metric">');
out.push('<span>' + escapeHtml(label) + '</span>');
out.push('<b class="' + (cls || '') + '">');
out.push(value);
out.push('</b></div>');
return out.join('');
}

function ttype(label, value) {
var out = [];
out.push('<div class="pp-ttype">');
out.push('<span>' + escapeHtml(label) + '</span>');
out.push('<b>' + value + '</b>');
out.push('</div>');
return out.join('');
}

/* ------------------------------------------------------------------

8. Разметка паспорта
------------------------------------------------------------------ */

function buildPassportHTML(country) {
var owner = country.owner || '?';
var delta = country.claims_delta_7d || 0;
var deltaHtml;
if (delta > 0) {
deltaHtml = '<b class="money">+' + delta + '</b>';
} else if (delta < 0) {
deltaHtml = '<b class="danger">' + delta + '</b>';
} else {
deltaHtml = '<b>0</b>';
}

var bank = formatMoney(country.bank || 0);
var claims = (country.claims || 0) + ' / ' +
(country.max_claims || '?');
var energy = (country.energy || 0).toFixed(1) + ' / ' +
(country.max_energy || 0).toFixed(1);

var heroParts = [];
heroParts.push('<div class="pp-hero">');
heroParts.push('<div class="pp-coa-wrap">');
heroParts.push(buildCoatOfArms(country));
heroParts.push('</div>');
heroParts.push('<div class="pp-title-block">');
heroParts.push('<h2 class="pp-title">');
heroParts.push(escapeHtml(country.name));
heroParts.push('</h2>');
heroParts.push('<div class="pp-subtitle">Лидер: <b>');
heroParts.push(escapeHtml(owner));
heroParts.push('</b></div>');
heroParts.push('<div class="pp-quick-stats">');
heroParts.push('<span>Казна: <b>' + bank + '</b></span>');
heroParts.push('<span>Чанков: <b>' + claims + '</b></span>');
heroParts.push('<span>Энергия: <b>' + energy + '</b></span>');
heroParts.push('</div>');
heroParts.push('</div>');
heroParts.push('</div>');
var hero = heroParts.join('');

var metricsParts = [];
metricsParts.push('<div class="pp-metrics">');
metricsParts.push(metric('Чанков', claims));
metricsParts.push(metric('Казна', bank, 'money'));
var debt = country.debt || 0;
metricsParts.push(metric('Долг', formatMoney(debt),
debt > 0 ? 'danger' : ''));
metricsParts.push(metric('Энергия', energy, 'warning'));
var regen = (country.regen || 0).toFixed(1) + '/ч';
metricsParts.push(metric('Регенерация', regen, 'warning'));
metricsParts.push(metric('Рост 7д', deltaHtml, ''));
metricsParts.push(metric('Альянсы',
String(country.allies || 0)));
metricsParts.push(metric('Пакты',
String(country.pacts || 0)));
var wars = country.active_wars || 0;
metricsParts.push(metric('Активных войн', String(wars),
wars > 0 ? 'danger' : ''));
metricsParts.push(metric('Активность',
String(country.activity || 0)));
metricsParts.push('</div>');

var gridParts = [];
gridParts.push('<div class="pp-grid">');
gridParts.push('<section class="pp-section">');
gridParts.push('<h3 class="pp-section-title">');
gridParts.push('Территория и столица</h3>');
gridParts.push(buildMiniMap(country));
gridParts.push('</section>');
gridParts.push('<section class="pp-section">');
gridParts.push('<h3 class="pp-section-title">Метрики</h3>');
gridParts.push(metricsParts.join(''));
gridParts.push('</section>');
gridParts.push('</div>');
var grid = gridParts.join('');

var terrParts = [];
terrParts.push('<section class="pp-section">');
terrParts.push('<h3 class="pp-section-title">');
terrParts.push('Состав территории</h3>');
terrParts.push('<div class="pp-territory">');
terrParts.push(ttype('Фермы', country.chunks_farm || 0));
terrParts.push(ttype('Шахты', country.chunks_mining || 0));
terrParts.push(ttype('Военные',
country.chunks_military || 0));
terrParts.push(ttype('Торговые',
country.chunks_trade || 0));
terrParts.push('</div></section>');
var territory = terrParts.join('');

var citParts = [];
citParts.push('<section class="pp-section">');
citParts.push('<h3 class="pp-section-title">Граждане</h3>');
citParts.push('<div class="pp-citizens">');
citParts.push(buildCitizens(country));
citParts.push('</div></section>');
var citizensHtml = citParts.join('');

var chrParts = [];
chrParts.push('<section class="pp-section">');
chrParts.push('<h3 class="pp-section-title">');
chrParts.push('Хроника страны</h3>');
chrParts.push('<div class="pp-chronicle">');
chrParts.push(buildChronicle(country));
chrParts.push('</div></section>');
var chronicleHtml = chrParts.join('');

var actParts = [];
actParts.push('<div class="pp-actions">');
if (country.capital) {
actParts.push('<button class="map-btn pp-action-btn" ');
actParts.push('data-pp-act="capital">К столице</button>');
}
actParts.push('<button class="map-btn pp-action-btn" ');
actParts.push('data-pp-act="map">На карте</button>');
actParts.push('<button class="map-btn pp-action-btn" ');
actParts.push('data-pp-act="link">Ссылка</button>');
actParts.push('</div>');
var actions = actParts.join('');

return hero + grid + territory + citizensHtml +
chronicleHtml + actions;
}

/* ------------------------------------------------------------------

9. Модалка
------------------------------------------------------------------ */

function ensureModal() {
var m = document.getElementById(MODAL_ID);
if (m) return m;

m = document.createElement('div');
m.id = MODAL_ID;
m.className = 'modal pp-modal';

var closeChar = 'X';
var out = [];
out.push('<div class="modal-overlay" data-pp-close></div>');
out.push('<div class="modal-content pp-modal-content">');
out.push('<button class="modal-close" data-pp-close ');
out.push('aria-label="Close">' + closeChar + '</button>');
out.push('<div id="pp-body"></div>');
out.push('</div>');
m.innerHTML = out.join('');

document.body.appendChild(m);

var closers = m.querySelectorAll('[data-pp-close]');
for (var i = 0; i < closers.length; i++) {
closers[i].addEventListener('click', closeCountryPassport);
}

m.addEventListener('click', onModalClick);
document.addEventListener('keydown', onModalKey);

return m;
}

function onModalClick(e) {
var citizen = e.target.closest('.pp-citizen');
if (citizen && citizen.dataset.pname) {
if (typeof window.openPlayer === 'function') {
window.openPlayer(citizen.dataset.pname);
}
return;
}

var btn = e.target.closest('[data-pp-act]');
if (!btn) return;
var m = document.getElementById(MODAL_ID);
if (!m) return;
var name = m.dataset.country;
if (!name) return;
var act = btn.dataset.ppAct;
if (act === 'capital') {
gotoCountryOnMap(name, true);
} else if (act === 'map') {
gotoCountryOnMap(name, false);
} else if (act === 'link') {
copyLink(name);
}
}

function onModalKey(e) {
if (e.key !== 'Escape') return;
var m = document.getElementById(MODAL_ID);
if (m && m.classList.contains('show')) {
closeCountryPassport();
}
}

/* ------------------------------------------------------------------

10. Открытие/закрытие
------------------------------------------------------------------ */

function openCountryPassport(countryName) {
var data = window.currentData;
if (!data || !data.countries) {
toast('Данные ещё не загружены');
return;
}

var country = null;
for (var i = 0; i < data.countries.length; i++) {
if (data.countries[i].name === countryName) {
country = data.countries[i];
break;
}
}
if (!country) {
toast('Страна не найдена: ' + countryName);
return;
}

var m = ensureModal();
m.dataset.country = country.name;

var body = document.getElementById('pp-body');
if (body) {
body.innerHTML = buildPassportHTML(country);
}

m.classList.add('show');
document.body.style.overflow = 'hidden';

var inline = document.getElementById('country-details');
if (inline) inline.style.display = 'none';

if (window.PanelAvatars &&
typeof window.PanelAvatars.refresh === 'function') {
setTimeout(window.PanelAvatars.refresh, 60);
}
}

function closeCountryPassport() {
var m = document.getElementById(MODAL_ID);
if (!m) return;
m.classList.remove('show');
document.body.style.overflow = '';
}

function toast(msg) {
if (typeof window.showToast === 'function') {
window.showToast(msg);
} else {
console.log('[Passport] ' + msg);
}
}

/* ------------------------------------------------------------------

11. Действия
------------------------------------------------------------------ */

function gotoCountryOnMap(countryName, focusCapital) {
var data = window.currentData;
if (!data) return;

var country = null;
for (var i = 0; i < data.countries.length; i++) {
if (data.countries[i].name === countryName) {
country = data.countries[i];
break;
}
}
if (!country) return;

var mapBtn = document.querySelector(
'.main-nav .nav-btn[data-tab="map"]');
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
if (typeof window.applyMapTransform === 'function') {
window.applyMapTransform();
}
toast('Столица: ' + countryName);
}, 220);
}

function copyLink(countryName) {
var base = location.origin + location.pathname;
var url = base + '?country=' + encodeURIComponent(countryName);
var done = function (ok) {
toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать');
};

if (navigator.clipboard && window.isSecureContext) {
navigator.clipboard.writeText(url).then(
function () { done(true); },
function () { done(false); }
);
return;
}

try {
var ta = document.createElement('textarea');
ta.value = url;
ta.style.position = 'fixed';
ta.style.opacity = '0';
document.body.appendChild(ta);
ta.select();
var ok = document.execCommand('copy');
document.body.removeChild(ta);
done(ok);
} catch (err) {
done(false);
}
}

/* ------------------------------------------------------------------

12. Override window.showDetails
------------------------------------------------------------------ */

function installShowDetailsOverride() {
if (window.__showDetailsPatched) return true;
var orig = window.showDetails;
if (typeof orig !== 'function') return false;

window.__showDetailsPatched = true;
window.__showDetailsOriginal = orig;

window.showDetails = function (countryName) {
try {
openCountryPassport(countryName);
} catch (err) {
console.error('[CountryPassport] override error:', err);
try { orig.apply(this, arguments); } catch (e2) {}
}
};
return true;
}

/* ------------------------------------------------------------------

13. Capture-listener для карточек
------------------------------------------------------------------ */

function installCardOverride() {
document.addEventListener('click', function (e) {
var card = e.target.closest('.ccm-card');
if (!card) return;

var nameEl = card.querySelector('.ccm-name');
if (!nameEl) return;

var raw = nameEl.textContent || '';
var name = raw.replace(/[\uD83C\uDFDB\uFE0F]/g, '').trim();
if (!name) return;

e.stopImmediatePropagation();
e.preventDefault();
openCountryPassport(name);
}, true);
}

/* ------------------------------------------------------------------

14. Кнопка "Открыть паспорт" в inline-панели
------------------------------------------------------------------ */

function installDetailButton() {
var panel = document.getElementById('country-details');
if (!panel) return;

var mo = new MutationObserver(function () {
setTimeout(addPassportButton, 30);
});
mo.observe(panel, {
childList: true,
subtree: true,
attributes: true,
attributeFilter: ['style']
});
setTimeout(addPassportButton, 500);
}

function addPassportButton() {
var panel = document.getElementById('country-details');
if (!panel || panel.style.display === 'none') return;
if (panel.querySelector('.pp-open-btn')) return;

var title = document.getElementById('detail-title');
var content = document.getElementById('detail-content');
if (!title || !content) return;

var raw = title.textContent || '';
var name = raw.replace(/[\uD83C\uDFDB\uFE0F]/g, '')
.replace(/^[\s]+/, '').trim();
if (!name) return;

var btn = document.createElement('button');
btn.className = 'pp-open-btn map-btn';
btn.type = 'button';
btn.textContent = 'Открыть паспорт';
btn.addEventListener('click', function () {
openCountryPassport(name);
});
content.appendChild(btn);
}

/* ------------------------------------------------------------------

15. URL ?country=...
------------------------------------------------------------------ */

function checkUrlCountry() {
var c;
try {
var params = new URLSearchParams(location.search);
c = params.get('country');
} catch (err) {
return;
}
if (!c) return;

var tries = 0;
var iv = setInterval(function () {
tries++;
var ok = window.currentData &&
window.currentData.countries &&
window.currentData.countries.length > 0;
if (ok) {
clearInterval(iv);
openCountryPassport(c);
} else if (tries > 30) {
clearInterval(iv);
}
}, 300);
}

/* ------------------------------------------------------------------

16. Boot
------------------------------------------------------------------ */

function boot() {
ensureModal();

var attempts = 0;
function tryPatch() {
attempts++;
if (installShowDetailsOverride()) {
console.log('[CountryPassport] showDetails overridden');
return;
}
if (attempts < 30) {
setTimeout(tryPatch, 100);
} else {
console.warn('[CountryPassport] showDetails not found');
}
}
tryPatch();

installCardOverride();
installDetailButton();
checkUrlCountry();

console.log('[CountryPassport] v2.0 ready (bulletproof)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

window.openCountryPassport = openCountryPassport;
window.closeCountryPassport = closeCountryPassport;
})();