/* SOVEREIGNTY PANEL - country-passport.js v3.0
Minimal, DOM-based, ASCII-only.
Overrides window.showDetails to open modal passport.
*/
(function () {
'use strict';

var MODAL_ID = 'country-modal';

/* --- helpers --- */
function txt(s) {
return s == null ? '' : String(s);
}

function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text != null) n.textContent = text;
return n;
}

/* Russian strings via unicode escapes to keep ASCII source */
var RU = {
modalClose: '\u2715',
noData: '\u0414\u0430\u043d\u043d\u044b\u0435 \u0435\u0449\u0451 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b',
notFound: '\u0421\u0442\u0440\u0430\u043d\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430: ',
leader: '\u041b\u0438\u0434\u0435\u0440: ',
bank: '\u041a\u0430\u0437\u043d\u0430: ',
claims: '\u0427\u0430\u043d\u043a\u043e\u0432: ',
energy: '\u042d\u043d\u0435\u0440\u0433\u0438\u044f: ',
citizens: '\u0413\u0440\u0430\u0436\u0434\u0430\u043d\u0435',
chronicle: '\u0425\u0440\u043e\u043d\u0438\u043a\u0430 \u0441\u0442\u0440\u0430\u043d\u044b',
empty: '\u041f\u0443\u0441\u0442\u043e'
};

function toast(msg) {
if (typeof window.showToast === 'function') window.showToast(msg);
else console.log('[Passport] ' + msg);
}

/* --- find country --- */
function findCountry(name) {
var d = window.currentData;
if (!d || !d.countries) return null;
for (var i = 0; i < d.countries.length; i++) {
if (d.countries[i].name === name) return d.countries[i];
}
return null;
}

/* --- modal skeleton --- */
function ensureModal() {
var m = document.getElementById(MODAL_ID);
if (m) return m;

m = el('div', 'modal pp-modal');
m.id = MODAL_ID;

var ov = el('div', 'modal-overlay');
ov.setAttribute('data-pp-close', '1');

var body = el('div', 'modal-content pp-modal-content');

var close = el('button', 'modal-close', RU.modalClose);
close.setAttribute('data-pp-close', '1');
close.setAttribute('type', 'button');

var host = el('div');
host.id = 'pp-body';

body.appendChild(close);
body.appendChild(host);
m.appendChild(ov);
m.appendChild(body);
document.body.appendChild(m);

var closers = m.querySelectorAll('[data-pp-close]');
for (var i = 0; i < closers.length; i++) {
closers[i].addEventListener('click', closePassport);
}

document.addEventListener('keydown', function (e) {
if (e.key === 'Escape') closePassport();
});

return m;
}

/* --- build passport DOM (no HTML strings) --- */
function renderPassport(host, c) {
host.textContent = '';

var hero = el('div', 'pp-hero');
var nameEl = el('h2', 'pp-title', txt(c.name));
var subEl = el('div', 'pp-subtitle', RU.leader + txt(c.owner || '?'));
var quick = el('div', 'pp-quick-stats');
quick.appendChild(el('span', null, RU.bank + (c.bank || 0)));
quick.appendChild(el('span', null, RU.claims +
(c.claims || 0) + ' / ' + (c.max_claims || '?')));
quick.appendChild(el('span', null, RU.energy +
(c.energy || 0) + ' / ' + (c.max_energy || 0)));
var titleBlock = el('div', 'pp-title-block');
titleBlock.appendChild(nameEl);
titleBlock.appendChild(subEl);
titleBlock.appendChild(quick);
hero.appendChild(titleBlock);
host.appendChild(hero);

/* citizens */
var citWrap = el('section', 'pp-section');
var citTitle = el('h3', 'pp-section-title', RU.citizens);
citWrap.appendChild(citTitle);
var citizens = (window.currentData.players || []).filter(function (p) {
return p.country === c.name;
});
if (citizens.length === 0) {
citWrap.appendChild(el('div', 'pp-chr-empty', RU.empty));
} else {
var list = el('div', 'pp-citizens');
for (var i = 0; i < citizens.length; i++) {
var p = citizens[i];
var row = el('div', 'pp-citizen');
row.setAttribute('data-pname', txt(p.name));
var n = el('span', 'pp-citizen-name', txt(p.name));
var r = el('span', 'pp-citizen-role');
if (p.country_role === 'leader') r.textContent = 'L';
else if (p.country_role === 'co_ruler') r.textContent = 'Co';
else if (p.online) r.textContent = 'on';
row.appendChild(n);
row.appendChild(r);
list.appendChild(row);
}
citWrap.appendChild(list);
}
host.appendChild(citWrap);

/* chronicle */
var chrWrap = el('section', 'pp-section');
chrWrap.appendChild(el('h3', 'pp-section-title', RU.chronicle));
var events = (window.currentData.event_log || []).filter(function (e) {
return e.message && e.message.indexOf(c.name) !== -1;
});
if (events.length === 0) {
chrWrap.appendChild(el('div', 'pp-chr-empty', RU.empty));
} else {
var feed = el('div', 'pp-chronicle');
for (var j = 0; j < events.length && j < 8; j++) {
var ev = events[j];
var item = el('div', 'pp-chr-item');
var icon = el('div', 'pp-chr-icon', txt(ev.icon || '-'));
var body = el('div', 'pp-chr-body');
body.appendChild(el('div', 'pp-chr-msg', txt(ev.message)));
item.appendChild(icon);
item.appendChild(body);
feed.appendChild(item);
}
chrWrap.appendChild(feed);
}
host.appendChild(chrWrap);
}

/* --- public API --- */
function openPassport(name) {
var c = findCountry(name);
if (!c) { toast(RU.notFound + name); return; }
var m = ensureModal();
m.dataset.country = c.name;
renderPassport(document.getElementById('pp-body'), c);
m.classList.add('show');
document.body.style.overflow = 'hidden';
}

function closePassport() {
var m = document.getElementById(MODAL_ID);
if (!m) return;
m.classList.remove('show');
document.body.style.overflow = '';
}

/* --- override showDetails --- */
function installOverride() {
if (window.__showDetailsPatched) return true;
var orig = window.showDetails;
if (typeof orig !== 'function') return false;
window.__showDetailsPatched = true;
window.__showDetailsOriginal = orig;
window.showDetails = function (name) {
try { openPassport(name); }
catch (e) { console.error('[Passport]', e); try { orig.apply(this, arguments); } catch (x) {} }
};
console.log('[CountryPassport] v3.0 ready');
return true;
}

var tries = 0;
function tryPatch() {
tries++;
if (!installOverride() && tries < 50) setTimeout(tryPatch, 100);
}
tryPatch();

window.openCountryPassport = openPassport;
window.closeCountryPassport = closePassport;

})();