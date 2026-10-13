/* ============================================================
SOVEREIGNTY PANEL / PANEL-ICONS.JS v1.0
============================================================
Custom SVG icon set. Replaces emoji with clean inline SVGs.

Usage:
var svg = PanelIcons.element('money', 18);   // DOM node
var str = PanelIcons.svg('money', 18);       // SVG string
PanelIcons.names();                          // list all names

Icons use currentColor for stroke/fill so they inherit
the surrounding text color. Works in light & dark themes.

Source is ASCII-only by project convention.
============================================================ */
(function () {
'use strict';

var SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------------------------------------------------------------
Icon definitions.
fields:
fill: true      -> solid silhouette (default for charges)
strokeWidth     -> override stroke width (default 2)
paths: [{ d, fill?, stroke?, width? }]
--------------------------------------------------------------- */
var ICONS = {

/* --- UI icons (stroke-based) --- */

money: {
paths: [
{ d: 'M12 2v20' },
{ d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' }
]
},

map: {
paths: [
{ d: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z' },
{ d: 'M9 4v16' },
{ d: 'M15 6v16' }
]
},

bolt: {
paths: [
{ d: 'M13 2L4 14h6l-1 8 9-12h-6z' }
]
},

farm: {
paths: [
{ d: 'M12 22V4' },
{ d: 'M12 6l-2-2M12 6l2-2' },
{ d: 'M12 10l-2-2M12 10l2-2' },
{ d: 'M12 14l-2-2M12 14l2-2' },
{ d: 'M12 18l-2-2M12 18l2-2' }
]
},

mine: {
paths: [
{ d: 'M3 21L13 11' },
{ d: 'M15 2c-3 1-5 3-6 6l2 2c1-2 3-4 5-5z' },
{ d: 'M15 2c3 1 5 3 6 6l-2 2c-1-2-3-4-5-5z' }
]
},

war: {
paths: [
{ d: 'M4 4l16 16' },
{ d: 'M20 4L4 20' }
]
},

trade: {
paths: [
{ d: 'M6 8h12l1 12H5z' },
{ d: 'M9 8V6a3 3 0 0 1 6 0v2' }
]
},

capital: {
paths: [
{ d: 'M3 21h18' },
{ d: 'M5 21V10L12 5l7 5v11' },
{ d: 'M9 21v-6h6v6' }
]
},

scroll: {
paths: [
{ d: 'M6 4h11a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z' },
{ d: 'M8 9h8' },
{ d: 'M8 13h8' },
{ d: 'M8 17h5' }
]
},

'arrow-right': {
paths: [
{ d: 'M5 12h14' },
{ d: 'M13 6l6 6-6 6' }
]
},

close: {
paths: [
{ d: 'M6 6l12 12' },
{ d: 'M18 6L6 18' }
]
},

users: {
paths: [
{ d: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
{ d: 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6' },
{ d: 'M16 6a3 3 0 0 1 0 6' },
{ d: 'M21 20c0-3-2-5.5-5-6' }
]
},

info: {
paths: [
{ d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
{ d: 'M12 11v6' },
{ d: 'M12 7.5v.01' }
]
},

check: {
paths: [
{ d: 'M4 12l6 6L20 6' }
]
},

/* --- Coat of arms charges (solid silhouettes) --- */

'charge-sword': {
fill: true,
paths: [
{ d: 'M12 1l-1 3v12h2V4z' },
{ d: 'M8 15h8v2H8z' },
{ d: 'M11 17v3h2v-3z' }
]
},

'charge-shield': {
fill: true,
paths: [
{ d: 'M12 2l8 2v8c0 5-3.5 9-8 10-4.5-1-8-5-8-10V4z' }
]
},

'charge-crown': {
fill: true,
paths: [
{ d: 'M3 19h18v2H3z' },
{ d: 'M3 19L2 8l5 3 5-7 5 7 5-3-1 11z' }
]
},

'charge-star': {
fill: true,
paths: [
{ d: 'M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.7L12 16.9 5.8 20.2l1.6-6.7L2.2 8.9l6.9-.6z' }
]
},

'charge-moon': {
fill: true,
paths: [
{ d: 'M20 14a8 8 0 1 1-9-9 6.5 6.5 0 0 0 9 9z' }
]
},

'charge-sun': {
fill: true,
paths: [
{ d: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z' },
{ d: 'M12 1.5l-1 2.5h2z' },
{ d: 'M12 20l-1 2.5h2z' },
{ d: 'M1.5 12l2.5-1v2z' },
{ d: 'M20 12l2.5-1v2z' },
{ d: 'M4.5 4.5l1.5 1.5 1.5-1.5-1.5-1.5z' },
{ d: 'M16.5 4.5l1.5 1.5 1.5-1.5-1.5-1.5z' },
{ d: 'M4.5 19.5l1.5-1.5 1.5 1.5-1.5 1.5z' },
{ d: 'M16.5 19.5l1.5-1.5 1.5 1.5-1.5 1.5z' }
]
},

'charge-flame': {
fill: true,
paths: [
{ d: 'M12 2c2 5 6 7 6 12a6 6 0 1 1-12 0c0-3 2-5 4-7 0 2 1 3 2 3 0-3 0-6 0-8z' }
]
},

'charge-snow': {
strokeWidth: 2.5,
paths: [
{ d: 'M12 2v20' },
{ d: 'M3 12h18' },
{ d: 'M5 5l14 14' },
{ d: 'M19 5L5 19' }
]
},

'charge-wave': {
strokeWidth: 2.4,
paths: [
{ d: 'M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0' },
{ d: 'M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0' },
{ d: 'M2 20c2-3 4-3 6 0s4 3 6 0 4-3 6 0' }
]
},

'charge-tree': {
fill: true,
paths: [
{ d: 'M12 1l-5 7h3l-5 8h5v7h4v-7h5l-5-8h3z' }
]
},

'charge-cross': {
fill: true,
paths: [
{ d: 'M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z' }
]
},

'charge-anchor': {
strokeWidth: 2.2,
paths: [
{ d: 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
{ d: 'M12 7v13' },
{ d: 'M8 11h8' },
{ d: 'M5 14H2a10 10 0 0 0 20 0h-3' }
]
},

'charge-castle': {
fill: true,
paths: [
{ d: 'M4 21V9h2V7h2v2h2V7h2v2h2V7h2v2h2V7h2v2h2v12z' },
{ d: 'M10 21v-5h4v5z' }
]
},

'charge-key': {
strokeWidth: 2.2,
paths: [
{ d: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
{ d: 'M10 10l10 10-2 2-2-2-2 2-2-2' }
]
},

'charge-hammer': {
fill: true,
paths: [
{ d: 'M14 3l7 7-2 2-7-7z' },
{ d: 'M12 5L3 14l5 5 9-9z' }
]
},

'charge-chalice': {
fill: true,
paths: [
{ d: 'M7 3h10v4a5 5 0 0 1-4 4.9V17h4v2H7v-2h4v-5.1A5 5 0 0 1 7 7z' }
]
}

};

/* ---------------------------------------------------------------
Build
--------------------------------------------------------------- */

function buildSvg(name, size) {
var spec = ICONS[name];
if (!spec) return null;

size = size || 20;

var svg = document.createElementNS(SVG_NS, 'svg');
svg.setAttribute('viewBox', '0 0 24 24');
svg.setAttribute('width', size);
svg.setAttribute('height', size);
svg.setAttribute('aria-hidden', 'true');
svg.setAttribute('focusable', 'false');
svg.classList.add('panel-icon');
svg.classList.add('panel-icon-' + name);

var solid = !!spec.fill;
var dFill = solid ? 'currentColor' : 'none';
var dStroke = solid ? 'none' : 'currentColor';
var dWidth = spec.strokeWidth || 2;

svg.setAttribute('fill', dFill);
svg.setAttribute('stroke', dStroke);
if (!solid) {
svg.setAttribute('stroke-width', dWidth);
svg.setAttribute('stroke-linecap', 'round');
svg.setAttribute('stroke-linejoin', 'round');
}

var paths = spec.paths || [];
for (var i = 0; i < paths.length; i++) {
var p = paths[i];
var node = document.createElementNS(SVG_NS, 'path');
node.setAttribute('d', p.d);
if (p.fill != null) node.setAttribute('fill', p.fill);
if (p.stroke != null) node.setAttribute('stroke', p.stroke);
if (p.width != null) node.setAttribute('stroke-width', p.width);
svg.appendChild(node);
}
return svg;
}

function buildSvgString(name, size) {
var node = buildSvg(name, size);
if (!node) return '';
return node.outerHTML;
}

/* ---------------------------------------------------------------
Public API
--------------------------------------------------------------- */

window.PanelIcons = {
element: buildSvg,
svg: buildSvgString,
has: function (name) { return !!ICONS[name]; },
names: function () { return Object.keys(ICONS); }
};

})();