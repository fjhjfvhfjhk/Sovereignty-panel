/* SOVEREIGNTY PANEL / country-passport.js v3.5
DOM-based, ASCII-only. SVG icons via PanelIcons.

ИЗМЕНЕНИЯ v3.5 (13.10.2026):

- ФИКС герба: щит получает класс `.pp-coa-shield`, а эмблема
(SVG из PanelIcons) сохраняет собственный размер из атрибутов
width/height. Раньше CSS `.pp-coa svg { width:100%; height:100%; }`
раздувал эмблему до 100×120 — она выезжала за границы щита.
- ФИКС мини-карты: позиция пересчитывается ПОСЛЕ загрузки PNG,
по его naturalWidth/naturalHeight. Раньше координаты считались
от метаданных `map_meta.img_width/img_height`, и если реальный
файл отличался размером — пиксель столицы уезжал в угол.
- Добавлен onerror-фолбэк для мини-карты.
*/
(function () {
'use strict';

var MODAL_ID = 'country-modal';
var NS = 'http://www.w3.org/2000/svg';

function txt(s) { return s == null ? '' : String(s); }

function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text != null) n.textContent = text;
return n;
}

function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

function money(a) {
if (a == null) return '0';
var v = Math.abs(a);
if (v >= 1000000) return (a / 1000000).toFixed(2) + 'M';
if (v >= 1000) return (a / 1000).toFixed(1) + 'k';
return Math.round(a).toString();
}

function timeAgo(ts) {
if (!ts) return '';
var s = Math.floor((Date.now() - ts) / 1000);
if (s < 60) return 'только что';
var m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
var h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
return Math.floor(h / 24) + ' дн назад';
}

function hashName(name) {
var h = 0, s = txt(name || '?');
for (var i = 0; i < s.length; i++) {
h = ((h << 5) - h) + s.charCodeAt(i); h |= 0;
}
return Math.abs(h);
}

function icon(name, size) {
if (window.PanelIcons && window.PanelIcons.element) {
var n = window.PanelIcons.element(name, size || 16);
if (n) return n;
}
var d = document.createElementNS(NS, 'svg');
d.setAttribute('width', size || 16);
d.setAttribute('height', size || 16);
d.classList.add('panel-icon');
return d;
}

var CHARGES = [
'sword','shield','crown','star','moon','sun','flame','snow',
'wave','tree','cross','anchor','castle','key','hammer','chalice'
];

var T = {
leader:  '\u041b\u0438\u0434\u0435\u0440: ',
terr:    '\u0422\u0435\u0440\u0440\u0438\u0442\u043e\u0440\u0438\u044f \u0438 \u0441\u0442\u043e\u043b\u0438\u0446\u0430',
metrics: '\u041c\u0435\u0442\u0440\u0438\u043a\u0438',
comp:    '\u0421\u043e\u0441\u0442\u0430\u0432 \u0442\u0435\u0440\u0440\u0438\u0442\u043e\u0440\u0438\u0438',
citizens:'\u0413\u0440\u0430\u0436\u0434\u0430\u043d\u0435',
chr:     '\u0425\u0440\u043e\u043d\u0438\u043a\u0430 \u0441\u0442\u0440\u0430\u043d\u044b',
noMap:   '\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435 \u043a\u0430\u0440\u0442\u044b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b',
noCap:   '\u0421\u0442\u043e\u043b\u0438\u0446\u0430 \u043d\u0435 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430',
noMapPng:'\u041a\u0430\u0440\u0442\u0430 \u0435\u0449\u0451 \u043d\u0435 \u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u0430',
hintSet: '\u041f\u043e\u0441\u0442\u0430\u0432\u044c: /c capital set',
mChunks: '\u0427\u0430\u043d\u043a\u043e\u0432',
mBank:   '\u041a\u0430\u0437\u043d\u0430',
mDebt:   '\u0414\u043e\u043b\u0433',
mEnergy: '\u042d\u043d\u0435\u0440\u0433\u0438\u044f',
mRegen:  '\u0420\u0435\u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f',
mDelta:  '\u0420\u043e\u0441\u0442 7\u0434',
mAllies: '\u0410\u043b\u044c\u044f\u043d\u0441\u044b',
mPacts:  '\u041f\u0430\u043a\u0442\u044b',
mWars:   '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432\u043e\u0439\u043d',
mAct:    '\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
tFarm:   '\u0424\u0435\u0440\u043c\u044b',
tMine:   '\u0428\u0430\u0445\u0442\u044b',
tMil:    '\u0412\u043e\u0435\u043d\u043d\u044b\u0435',
tTrade:  '\u0422\u043e\u0440\u0433\u043e\u0432\u044b\u0435',
rLeader: '\u041b\u0438\u0434\u0435\u0440',
rCo:     '\u0421\u043e-\u043f\u0440\u0430\u0432\u0438\u0442\u0435\u043b\u044c',
rOn:     '\u043e\u043d\u043b\u0430\u0439\u043d',
bCapital:'\u041a \u0441\u0442\u043e\u043b\u0438\u0446\u0435',
bMap:    '\u041d\u0430 \u043a\u0430\u0440\u0442\u0435',
bLink:   '\u0421\u0441\u044b\u043b\u043a\u0430',
noCit:   '\u0412 \u0441\u0442\u0440\u0430\u043d\u0435 \u043f\u043e\u043a\u0430 \u043e\u0434\u0438\u043d \u043b\u0438\u0434\u0435\u0440',
noChr:   '\u0412 \u0445\u0440\u043e\u043d\u0438\u043a\u0430\u0445 \u0435\u0449\u0451 \u043d\u0435\u0442 \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439',
empty:   '\u041f\u0443\u0441\u0442\u043e',
notFound:'\u0421\u0442\u0440\u0430\u043d\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430: ',
noData:  '\u0414\u0430\u043d\u043d\u044b\u0435 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b',
okCopy:  '\u0421\u0441\u044b\u043b\u043a\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430',
failCopy:'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
okCap:   '\u0421\u0442\u043e\u043b\u0438\u0446\u0430: ',
openPP:  '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u0441\u043f\u043e\u0440\u0442'
};

var SHIELD_SVG =
'<path d="M 12 7 L 92 7 L 92 62 Q 92 107 52 117 Q 12 107 12 62 Z" ' +
'fill="rgba(0,0,0,0.28)" transform="translate(3,3)"/>' +
'<path d="M 10 5 L 90 5 L 90 60 Q 90 105 50 115 Q 10 105 10 60 Z" ' +
'fill="var(--cc)" stroke="#2A1A0F" stroke-width="2.5"/>' +
'<path d="M 15 10 L 85 10 L 85 58 Q 85 98 50 108 Q 15 98 15 58 Z" ' +
'fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>' +
'<path d="M 18 13 L 82 13 L 82 56 Q 82 95 50 104 Q 18 95 18 56 Z" ' +
'fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>';

function buildCoA(country) {
var color = country.color || '#6366f1';
var charge = CHARGES[hashName(country.name) % CHARGES.length];

var wrap = el('div', 'pp-coa');
wrap.style.setProperty('--cc', color);

// v3.5: щит получает ЯВНЫЙ класс, чтобы CSS не задевал
// SVG-эмблему ниже (раньше был широкий селектор `.pp-coa svg`,
// который раздувал эмблему до 100×120).
var shield = document.createElementNS(NS, 'svg');
shield.setAttribute('viewBox', '0 0 100 120');
shield.classList.add('pp-coa-shield');
shield.innerHTML = SHIELD_SVG;
wrap.appendChild(shield);

var ch = icon(charge, 38);
ch.classList.add('pp-coa-charge');
wrap.appendChild(ch);
return wrap;
}

/**

- Мини-карта с центрированием на столице.
- 
- v3.5: позиция img рассчитывается ПОСЛЕ загрузки PNG — по
- naturalWidth/naturalHeight, а не по метаданным сервера. Если
- файл data/map.png есть в репозитории, но его размер отличается
- от map_meta.img_width/img_height, старая формула «промахивалась»
- мимо столицы. Теперь размер берётся у самого изображения.
*/
function buildMiniMap(country) {
var data = window.currentData;
if (!data || !data.map_meta) return el('div', 'pp-no-map', T.noMap);

var meta = data.map_meta;
var cap = country.capital;
if (!cap || cap.chunk_x == null || cap.chunk_z == null) {
var box = el('div', 'pp-no-map');
box.appendChild(icon('capital', 28));
box.appendChild(el('div', null, T.noCap));
box.appendChild(el('small', null, T.hintSet));
return box;
}

var mapBox = el('div', 'pp-map');
var img = document.createElement('img');
img.className = 'pp-map-img';
img.alt = '';
img.setAttribute('draggable', 'false');

var url = 'data/map.png';
if (meta.tiles_version) url += '?v=' + meta.tiles_version;

img.style.position = 'absolute';
img.style.imageRendering = 'pixelated';
img.style.maxWidth = 'none';
img.style.pointerEvents = 'none';
img.style.left = '50%';
img.style.top = '50%';
img.style.transform = 'translate(-50%, -50%)';
img.style.visibility = 'hidden';

var positioned = false;

function positionAtCapital() {
if (positioned) return;
var imgW = img.naturalWidth || meta.img_width || 0;
var imgH = img.naturalHeight || meta.img_height || 0;
if (imgW <= 0 || imgH <= 0) return;
positioned = true;

var ppb = (typeof meta.pixels_per_block === 'number' && meta.pixels_per_block > 0)
? meta.pixels_per_block : 1;
var minBX = meta.min_chunk_x * 16;
var minBZ = meta.min_chunk_z * 16;
var px = (cap.chunk_x * 16 + 8 - minBX) * ppb;
var pz = (cap.chunk_z * 16 + 8 - minBZ) * ppb;

px = Math.max(0, Math.min(imgW - 1, px));
pz = Math.max(0, Math.min(imgH - 1, pz));

var zoom = 2;
img.style.width  = (imgW * zoom) + 'px';
img.style.height = (imgH * zoom) + 'px';
img.style.left = '50%';
img.style.top  = '50%';
img.style.transform =
'translate(' + (-px * zoom) + 'px, ' + (-pz * zoom) + 'px)';
img.style.visibility = 'visible';
}

img.addEventListener('load', positionAtCapital);

img.onerror = function () {
positioned = true;
var parent = mapBox.parentNode;
if (parent) {
parent.replaceChild(el('div', 'pp-no-map', T.noMapPng), mapBox);
}
};

img.src = url;
mapBox.appendChild(img);

if (img.complete && img.naturalWidth > 0) {
positionAtCapital();
}

return mapBox;
}

function metric(label, value, cls) {
var m = el('div', 'pp-metric');
m.appendChild(el('span', null, label));
var b = el('b', cls || null);
if (value && value.nodeType) b.appendChild(value);
else b.textContent = txt(value);
m.appendChild(b);
return m;
}

function ttype(iconName, labelText, value) {
var t = el('div', 'pp-ttype');
var head = el('span');
head.appendChild(icon(iconName, 16));
head.appendChild(document.createTextNode(' ' + labelText));
t.appendChild(head);
t.appendChild(el('b', null, txt(value)));
return t;
}

function buildCitizens(country) {
var data = window.currentData;
var wrap = el('div', 'pp-citizens');
if (!data || !data.players) {
wrap.appendChild(el('div', 'pp-chr-empty', T.empty));
return wrap;
}
var arr = [];
for (var i = 0; i < data.players.length; i++) {
if (data.players[i].country === country.name) arr.push(data.players[i]);
}
if (arr.length === 0) {
wrap.appendChild(el('div', 'pp-chr-empty', T.noCit));
return wrap;
}
arr.sort(function (a, b) {
var oa = a.country_role === 'leader' ? 0
: a.country_role === 'co_ruler' ? 1 : 2;
var ob = b.country_role === 'leader' ? 0
: b.country_role === 'co_ruler' ? 1 : 2;
if (oa !== ob) return oa - ob;
return (b.playtime_seconds || 0) - (a.playtime_seconds || 0);
});
for (var j = 0; j < arr.length; j++) wrap.appendChild(citizenRow(arr[j], country));
return wrap;
}

function citizenRow(p, country) {
var name = p.name || '?';
var row = el('div', 'pp-citizen');
row.setAttribute('data-pname', name);

var avatar;
if (window.PanelAvatars && window.PanelAvatars.get) {
avatar = window.PanelAvatars.get(name, 32);
} else {
avatar = fallbackAvatar(name, country.color);
}
var img = document.createElement('img');
img.className = 'pp-citizen-avatar';
img.setAttribute('alt', '');
img.setAttribute('data-avatar-name', name);
img.src = avatar;
row.appendChild(img);
row.appendChild(el('span', 'pp-citizen-name', name));

var rt = '', rc = 'pp-citizen-role';
if (p.country_role === 'leader') { rt = T.rLeader; rc += ' leader'; }
else if (p.country_role === 'co_ruler') { rt = T.rCo; rc += ' co-ruler'; }
else if (p.online) rt = T.rOn;
if (rt) row.appendChild(el('span', rc, rt));
return row;
}

function fallbackAvatar(name, color) {
var letter = String(name).charAt(0).toUpperCase();
var fill = color || '#6366f1';
var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
'<rect width="32" height="32" rx="2" fill="' + fill + '"/>' +
'<text x="16" y="22" text-anchor="middle" font-family="Georgia" ' +
'font-size="17" font-weight="800" fill="white">' + letter + '</text></svg>';
return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function buildChronicle(country) {
var data = window.currentData;
var wrap = el('div', 'pp-chronicle');
if (!data || !data.event_log || data.event_log.length === 0) {
wrap.appendChild(el('div', 'pp-chr-empty', T.empty));
return wrap;
}
var rel = [];
for (var i = 0; i < data.event_log.length; i++) {
var e = data.event_log[i];
if (e.message && e.message.indexOf(country.name) !== -1) rel.push(e);
}
if (rel.length === 0) {
wrap.appendChild(el('div', 'pp-chr-empty', T.noChr));
return wrap;
}
var lim = Math.min(rel.length, 8);
for (var j = 0; j < lim; j++) {
var it = el('div', 'pp-chr-item');
it.appendChild(el('div', 'pp-chr-icon', txt(rel[j].icon || '-')));
var b = el('div', 'pp-chr-body');
b.appendChild(el('div', 'pp-chr-msg', txt(rel[j].message)));
b.appendChild(el('div', 'pp-chr-time', timeAgo(rel[j].ts)));
it.appendChild(b);
wrap.appendChild(it);
}
return wrap;
}

function sectionHeader(text) { return el('h3', 'pp-section-title', text); }

function quickStat(iconName, value) {
var s = el('span');
s.appendChild(icon(iconName, 14));
s.appendChild(el('b', null, value));
return s;
}

function actionBtn(act, label, iconName) {
var b = el('button', 'map-btn pp-action-btn');
b.setAttribute('type', 'button');
b.setAttribute('data-pp-act', act);
if (iconName) {
b.appendChild(icon(iconName, 16));
b.appendChild(document.createTextNode(' '));
}
b.appendChild(document.createTextNode(label));
return b;
}

function buildPassport(country) {
var root = document.createDocumentFragment();

var hero = el('div', 'pp-hero');
var coa = el('div', 'pp-coa-wrap');
coa.appendChild(buildCoA(country));
hero.appendChild(coa);

var tb = el('div', 'pp-title-block');
tb.appendChild(el('h2', 'pp-title', txt(country.name)));

var sub = el('div', 'pp-subtitle');
sub.appendChild(document.createTextNode(T.leader));
sub.appendChild(el('b', null, txt(country.owner || '?')));
tb.appendChild(sub);

var qs = el('div', 'pp-quick-stats');
qs.appendChild(quickStat('money', money(country.bank || 0)));
qs.appendChild(quickStat('map',
(country.claims || 0) + ' / ' + (country.max_claims || '?')));
qs.appendChild(quickStat('bolt',
(country.energy || 0).toFixed(1) + ' / ' +
(country.max_energy || 0).toFixed(1)));
tb.appendChild(qs);
hero.appendChild(tb);
root.appendChild(hero);

var grid = el('div', 'pp-grid');

var secMap = el('section', 'pp-section');
secMap.appendChild(sectionHeader(T.terr));
secMap.appendChild(buildMiniMap(country));
grid.appendChild(secMap);

var secMet = el('section', 'pp-section');
secMet.appendChild(sectionHeader(T.metrics));
var mw = el('div', 'pp-metrics');
mw.appendChild(metric(T.mChunks,
(country.claims || 0) + ' / ' + (country.max_claims || '?')));
mw.appendChild(metric(T.mBank, money(country.bank || 0), 'money'));
var debt = country.debt || 0;
mw.appendChild(metric(T.mDebt, money(debt), debt > 0 ? 'danger' : ''));
mw.appendChild(metric(T.mEnergy,
(country.energy || 0).toFixed(1) + ' / ' +
(country.max_energy || 0).toFixed(1), 'warning'));
mw.appendChild(metric(T.mRegen,
(country.regen || 0).toFixed(1) + '/\u0447', 'warning'));

var delta = country.claims_delta_7d || 0;
var dn = document.createElement('span');
if (delta > 0) { dn.className = 'money'; dn.textContent = '+' + delta; }
else if (delta < 0) { dn.className = 'danger'; dn.textContent = String(delta); }
else dn.textContent = '0';
mw.appendChild(metric(T.mDelta, dn, ''));

mw.appendChild(metric(T.mAllies, String(country.allies || 0)));
mw.appendChild(metric(T.mPacts, String(country.pacts || 0)));
var wars = country.active_wars || 0;
mw.appendChild(metric(T.mWars, String(wars), wars > 0 ? 'danger' : ''));
mw.appendChild(metric(T.mAct, String(country.activity || 0)));
secMet.appendChild(mw);
grid.appendChild(secMet);
root.appendChild(grid);

var secComp = el('section', 'pp-section');
secComp.appendChild(sectionHeader(T.comp));
var terr = el('div', 'pp-territory');
terr.appendChild(ttype('farm', T.tFarm, country.chunks_farm || 0));
terr.appendChild(ttype('mine', T.tMine, country.chunks_mining || 0));
terr.appendChild(ttype('sword', T.tMil, country.chunks_military || 0));
terr.appendChild(ttype('money', T.tTrade, country.chunks_trade || 0));
secComp.appendChild(terr);
root.appendChild(secComp);

var secCit = el('section', 'pp-section');
secCit.appendChild(sectionHeader(T.citizens));
secCit.appendChild(buildCitizens(country));
root.appendChild(secCit);

var secChr = el('section', 'pp-section');
secChr.appendChild(sectionHeader(T.chr));
secChr.appendChild(buildChronicle(country));
root.appendChild(secChr);

var actions = el('div', 'pp-actions');
if (country.capital) actions.appendChild(actionBtn('capital', T.bCapital, 'landmark'));
actions.appendChild(actionBtn('map', T.bMap, 'map'));
actions.appendChild(actionBtn('link', T.bLink, 'scroll'));
root.appendChild(actions);

return root;
}

function ensureModal() {
var m = document.getElementById(MODAL_ID);
if (m) return m;

m = el('div', 'modal pp-modal');
m.id = MODAL_ID;

var ov = el('div', 'modal-overlay');
ov.setAttribute('data-pp-close', '1');

var content = el('div', 'modal-content pp-modal-content');
var closeBtn = document.createElement('button');
closeBtn.className = 'modal-close';
closeBtn.setAttribute('data-pp-close', '1');
closeBtn.setAttribute('type', 'button');
closeBtn.setAttribute('aria-label', 'Close');
closeBtn.appendChild(icon('close', 16));

var body = el('div');
body.id = 'pp-body';
content.appendChild(closeBtn);
content.appendChild(body);
m.appendChild(ov);
m.appendChild(content);
document.body.appendChild(m);

var cs = m.querySelectorAll('[data-pp-close]');
for (var i = 0; i < cs.length; i++) cs[i].addEventListener('click', closePassport);
m.addEventListener('click', onModalClick);
document.addEventListener('keydown', onModalKey);
return m;
}

function onModalClick(e) {
var cit = e.target.closest('.pp-citizen');
if (cit && cit.getAttribute('data-pname')) {
if (typeof window.openPlayer === 'function') window.openPlayer(cit.getAttribute('data-pname'));
return;
}
var btn = e.target.closest('[data-pp-act]');
if (!btn) return;
var m = document.getElementById(MODAL_ID);
if (!m) return;
var name = m.getAttribute('data-country');
if (!name) return;
var act = btn.getAttribute('data-pp-act');
if (act === 'capital') gotoMap(name, true);
else if (act === 'map') gotoMap(name, false);
else if (act === 'link') copyLink(name);
}

function onModalKey(e) {
if (e.key !== 'Escape') return;
var m = document.getElementById(MODAL_ID);
if (m && m.classList.contains('show')) closePassport();
}

function openPassport(name) {
var data = window.currentData;
if (!data || !data.countries) { toast(T.noData); return; }
var c = null;
for (var i = 0; i < data.countries.length; i++) {
if (data.countries[i].name === name) { c = data.countries[i]; break; }
}
if (!c) { toast(T.notFound + name); return; }

var m = ensureModal();
m.setAttribute('data-country', c.name);
var body = document.getElementById('pp-body');
if (body) { clearNode(body); body.appendChild(buildPassport(c)); }
m.classList.add('show');
document.body.style.overflow = 'hidden';
var inline = document.getElementById('country-details');
if (inline) inline.style.display = 'none';
if (window.PanelAvatars && window.PanelAvatars.refresh) {
setTimeout(window.PanelAvatars.refresh, 60);
}
}

function closePassport() {
var m = document.getElementById(MODAL_ID);
if (!m) return;
m.classList.remove('show');
document.body.style.overflow = '';
}

function toast(msg) {
if (typeof window.showToast === 'function') window.showToast(msg);
else console.log('[Passport] ' + msg);
}

function gotoMap(countryName, focusCap) {
var data = window.currentData;
if (!data) return;
var c = null;
for (var i = 0; i < data.countries.length; i++) {
if (data.countries[i].name === countryName) { c = data.countries[i]; break; }
}
if (!c) return;
var mb = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
if (mb) mb.click();
closePassport();
setTimeout(function () {
if (!focusCap || !c.capital) {
if (window.highlightCountry) window.highlightCountry(countryName);
return;
}
var meta = data.map_meta;
if (!meta) return;
var cap = c.capital;
var ppb = meta.pixels_per_block || 1;
var px = (cap.chunk_x * 16 + 8 - meta.min_chunk_x * 16) * ppb;
var pz = (cap.chunk_z * 16 + 8 - meta.min_chunk_z * 16) * ppb;
var vp = document.getElementById('map-viewport');
if (!vp) return;
var zoom = 2;
window.mapZoom = zoom;
window.mapOffsetX = vp.clientWidth / 2 - px * zoom;
window.mapOffsetY = vp.clientHeight / 2 - pz * zoom;
if (window.applyMapTransform) window.applyMapTransform();
toast(T.okCap + countryName);
}, 220);
}

function copyLink(countryName) {
var url = location.origin + location.pathname +
'?country=' + encodeURIComponent(countryName);
var done = function (ok) { toast(ok ? T.okCopy : T.failCopy); };
if (navigator.clipboard && window.isSecureContext) {
navigator.clipboard.writeText(url).then(
function () { done(true); }, function () { done(false); });
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
} catch (e) { done(false); }
}

function installOverride() {
if (window.__showDetailsPatched) return true;
var orig = window.showDetails;
if (typeof orig !== 'function') return false;
window.__showDetailsPatched = true;
window.__showDetailsOriginal = orig;
window.showDetails = function (n) {
try { openPassport(n); }
catch (err) {
console.error('[Passport]', err);
try { orig.apply(this, arguments); } catch (e2) {}
}
};
return true;
}

function installDetailButton() {
var panel = document.getElementById('country-details');
if (!panel) return;
var mo = new MutationObserver(function () { setTimeout(addDetailBtn, 30); });
mo.observe(panel, { childList:true, subtree:true, attributes:true, attributeFilter:['style'] });
setTimeout(addDetailBtn, 500);
}

function addDetailBtn() {
var panel = document.getElementById('country-details');
if (!panel || panel.style.display === 'none') return;
if (panel.querySelector('.pp-open-btn')) return;
var title = document.getElementById('detail-title');
var content = document.getElementById('detail-content');
if (!title || !content) return;
var name = txt(title.textContent).replace(/[\uD83C\uDFDB\uFE0F]/g, '').trim();
if (!name) return;
var btn = el('button', 'pp-open-btn map-btn', T.openPP);
btn.setAttribute('type', 'button');
btn.addEventListener('click', function () { openPassport(name); });
content.appendChild(btn);
}

function checkUrl() {
var c;
try {
var p = new URLSearchParams(location.search);
c = p.get('country');
} catch (e) { return; }
if (!c) return;
var tries = 0;
var iv = setInterval(function () {
tries++;
var ok = window.currentData && window.currentData.countries
&& window.currentData.countries.length > 0;
if (ok) { clearInterval(iv); openPassport(c); }
else if (tries > 30) clearInterval(iv);
}, 300);
}

function boot() {
ensureModal();
var tries = 0;
function tryPatch() {
tries++;
if (installOverride()) {
console.log('[CountryPassport] v3.5 ready (shield class + minimap natural-size fix)');
return;
}
if (tries < 50) setTimeout(tryPatch, 100);
else console.warn('[CountryPassport] showDetails not found');
}
tryPatch();
installDetailButton();
checkUrl();
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else { boot(); }

window.openCountryPassport = openPassport;
window.closeCountryPassport = closePassport;

})();