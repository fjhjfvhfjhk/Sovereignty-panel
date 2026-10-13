/* SOVEREIGNTY PANEL / panel-emoji-replacer.js v1.0
Scans text nodes and replaces known emoji with SVG icons
from PanelIcons. Runs at boot + on DOM mutations.

Skips server-data containers (event log icons/messages,
passport chronicle) so game-provided emoji stay intact.
*/
(function () {
'use strict';

var MAP = {
'\uD83C\uDFE0': 'home',           /* house */
'\uD83D\uDDFA\uFE0F': 'map',      /* map */
'\uD83D\uDDFA': 'map',
'\uD83D\uDC65': 'users',          /* people */
'\uD83D\uDCDC': 'scroll',         /* scroll */
'\uD83D\uDCD6': 'book',           /* book */
'\u2328\uFE0F': 'keyboard',       /* keyboard */
'\u2328': 'keyboard',
'\uD83C\uDF81': 'gift',           /* gift */
'\uD83C\uDF13': 'theme',          /* theme half circle */
'\uD83C\uDF19': 'moon',
'\u2600\uFE0F': 'sun',
'\u2600': 'sun',
'\uD83D\uDD50': 'clock',
'\uD83D\uDD04': 'refresh',
'\uD83C\uDFDB\uFE0F': 'landmark',  /* classical building */
'\uD83C\uDFDB': 'landmark',
'\uD83D\uDCB0': 'money',          /* money bag */
'\u26A1': 'bolt',
'\uD83D\uDCC8': 'chart',          /* chart up */
'\uD83C\uDFC6': 'trophy',
'\u2728': 'sparkles',
'\u2694\uFE0F': 'war',
'\u2694': 'war',
'\uD83E\uDD1D': 'handshake',
'\uD83D\uDCCA': 'chart',          /* bar chart */
'\uD83D\uDCC4': 'scroll',         /* page facing up */
'\uD83C\uDFA8': 'palette',
'\uD83D\uDD0D': 'search',
'\u2699\uFE0F': 'info',
'\u2699': 'info',
'\u2191': 'arrowup',
'\u2B06\uFE0F': 'arrowup',
'\u2B06': 'arrowup',
'\u2693': 'anchor'
};

/* Emoji sorted longest-first for greedy match */
var KEYS = Object.keys(MAP).sort(function (a, b) {
return b.length - a.length;
});

var SKIP_SELECTOR =
'script,style,textarea,input,select,option,' +
'.panel-icon,.event-log-icon,.event-log-msg,' +
'.pp-chr-icon,.pp-chr-msg,.pp-coa-charge';

function isSkipped(el) {
if (!el || !el.closest) return false;
return !!el.closest(SKIP_SELECTOR);
}

function findEmojis(str) {
var out = [];
var i = 0;
while (i < str.length) {
var matched = null;
for (var k = 0; k < KEYS.length; k++) {
var em = KEYS[k];
if (str.indexOf(em, i) === i) { matched = em; break; }
}
if (matched) {
out.push({ index: i, len: matched.length, emoji: matched });
i += matched.length;
} else {
i++;
}
}
return out;
}

function replaceNode(textNode) {
var str = textNode.nodeValue;
if (!str) return;
var matches = findEmojis(str);
if (matches.length === 0) return;

var parent = textNode.parentNode;
if (!parent || isSkipped(parent)) return;

var frag = document.createDocumentFragment();
var cursor = 0;
for (var i = 0; i < matches.length; i++) {
var m = matches[i];
if (m.index > cursor) {
frag.appendChild(document.createTextNode(
str.substring(cursor, m.index)));
}
var iconName = MAP[m.emoji];
var svg = window.PanelIcons
? window.PanelIcons.element(iconName, 16)
: null;
if (svg) frag.appendChild(svg);
else frag.appendChild(document.createTextNode(m.emoji));
cursor = m.index + m.len;
}
if (cursor < str.length) {
frag.appendChild(document.createTextNode(str.substring(cursor)));
}
try { parent.replaceChild(frag, textNode); } catch (e) {}
}

function walk(root) {
if (!root || root.nodeType !== 1) return;
if (isSkipped(root)) return;

var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
acceptNode: function (node) {
if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
if (isSkipped(node.parentNode)) return NodeFilter.FILTER_REJECT;
return NodeFilter.FILTER_ACCEPT;
}
});

var nodes = [];
var n;
while ((n = walker.nextNode())) nodes.push(n);
for (var i = 0; i < nodes.length; i++) replaceNode(nodes[i]);
}

function boot() {
walk(document.body);

var mo = new MutationObserver(function (mutations) {
for (var i = 0; i < mutations.length; i++) {
var m = mutations[i];
if (m.type !== 'childList') continue;
for (var j = 0; j < m.addedNodes.length; j++) {
var node = m.addedNodes[j];
if (node.nodeType === 3) replaceNode(node);
else if (node.nodeType === 1) walk(node);
}
}
});
mo.observe(document.body, { childList: true, subtree: true });

console.log('[EmojiReplacer] v1.0 ready (' + KEYS.length + ' emoji mapped)');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

})();