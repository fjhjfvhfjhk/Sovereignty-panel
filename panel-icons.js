/* ============================================================
   SOVEREIGNTY PANEL · PANEL-ICONS.JS v1.2
   ============================================================
   Набор SVG-иконок + авто-замена [data-icon] → SVG.
   v1.2: добавлена функция autoReplace для декларативных иконок
         в HTML: <span data-icon="home">Обзор</span>
   ============================================================ */
(function () {
    'use strict';

    var NS = 'http://www.w3.org/2000/svg';

    var ICONS = {
        home:    { p:['M3 11l9-8 9 8','M5 10v10h5v-6h4v6h5V10'] },
        map:     { p:['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z','M9 4v16','M15 6v16'] },
        users:   { p:['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6','M16 6a3 3 0 0 1 0 6','M21 20c0-3-2-5.5-5-6'] },
        scroll:  { p:['M6 4h11a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z','M8 9h8','M8 13h8','M8 17h5'] },
        book:    { p:['M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2z','M6 2v18'] },
        keyboard:{ p:['M3 6h18v12H3z','M6 9h1','M9 9h1','M12 9h1','M15 9h1','M18 9h1','M6 12h1','M9 12h1','M12 12h1','M15 12h1','M18 12h1','M8 15h8'] },
        gift:    { p:['M3 9h18v3H3z','M4 12v9h16v-9','M12 9v12','M8 9a2 2 0 0 1 0-4 4 4 0 0 1 4 4','M16 9a2 2 0 0 0 0-4 4 4 0 0 0-4 4'] },
        clock:   { p:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','M12 7v5l3 2'] },
        refresh: { p:['M3 12a9 9 0 0 1 15-6.7L21 8','M21 3v5h-5','M21 12a9 9 0 0 1-15 6.7L3 16','M3 21v-5h5'] },
        theme:   { p:['M12 3a9 9 0 0 0 0 18 4.5 4.5 0 0 0 3-7.8 4.5 4.5 0 0 1 3-7.8A9 9 0 0 0 12 3z'] },
        moon:    { p:['M20 14A8 8 0 1 1 11 5a6.5 6.5 0 0 0 9 9z'] },
        sun:     { p:['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z','M12 1.5v2','M12 20.5v2','M1.5 12h2','M20.5 12h2','M4.6 4.6l1.4 1.4','M18 18l1.4 1.4','M4.6 19.4L6 18','M18 6l1.4-1.4'] },
        landmark:{ p:['M3 21h18','M5 21V10L12 5l7 5v11','M9 21v-6h6v6'] },
        money:   { p:['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'] },
        bolt:    { p:['M13 2L4 14h6l-1 8 9-12h-6z'] },
        chart:   { p:['M4 20V10','M10 20V4','M16 20v-8','M22 20H2'] },
        trophy:  { p:['M7 4h10v6a5 5 0 0 1-10 0z','M7 6H4a3 3 0 0 0 3 3','M17 6h3a3 3 0 0 1-3 3','M10 15h4v3h-4z','M8 22h8','M10 18v4','M14 18v4'] },
        sparkles:{ p:['M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z','M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z','M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z'] },
        war:     { p:['M4 4l16 16','M20 4L4 20'] },
        handshake:{ p:['M11 17l-2-2a2 2 0 0 1 0-3l3-3 4 4-3 3','M2 12l4-4 3 3','M22 12l-4-4-3 3','M9 15l4 4 3-3'] },
        crown:   { p:['M3 19h18v2H3z','M3 19L2 8l5 3 5-7 5 7 5-3-1 11z'] },
        castle:  { p:['M4 21V9h2V7h2v2h2V7h2v2h2V7h2v2h2V7h2v2h2v12','M10 21v-5h4v5'] },
        anchor:  { p:['M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z','M12 7v13','M8 11h8','M5 14H2a10 10 0 0 0 20 0h-3'], w:2.2 },
        star:    { p:['M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.7L12 16.9 5.8 20.2l1.6-6.7L2.2 8.9l6.9-.6z'] },
        flame:   { p:['M12 2c2 5 6 7 6 12a6 6 0 1 1-12 0c0-3 2-5 4-7 0 2 1 3 2 3z'] },
        snow:    { p:['M12 2v20','M3 12h18','M5 5l14 14','M19 5L5 19'], w:2.4 },
        wave:    { p:['M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0','M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0','M2 20c2-3 4-3 6 0s4 3 6 0 4-3 6 0'], w:2.2 },
        tree:    { s:true, p:['M12 1l-5 7h3l-5 8h5v7h4v-7h5l-5-8h3z'] },
        sword:   { s:true, p:['M12 1l-1 3v12h2V4z','M8 15h8v2H8z','M11 17v3h2v-3z'] },
        shield:  { s:true, p:['M12 2l8 2v8c0 5-3.5 9-8 10-4.5-1-8-5-8-10V4z'] },
        cross:   { s:true, p:['M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z'] },
        key:     { p:['M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M10 10l10 10-2 2-2-2-2 2-2-2'] },
        hammer:  { s:true, p:['M14 3l7 7-2 2-7-7z','M12 5L3 14l5 5 9-9z'] },
        chalice: { s:true, p:['M7 3h10v4a5 5 0 0 1-4 4.9V17h4v2H7v-2h4v-5.1A5 5 0 0 1 7 7z'] },
        arrowright: { p:['M5 12h14','M13 6l6 6-6 6'] },
        arrowup:    { p:['M12 5v14','M6 11l6-6 6 6'] },
        close:      { p:['M6 6l12 12','M18 6L6 18'] },
        search:     { p:['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.4-4.4'] },
        palette:    { p:['M12 21a9 9 0 1 1 0-18c5 0 9 3.5 9 8 0 2.5-2 4-4 4h-2a2 2 0 0 0-1.5 3.4A2 2 0 0 1 12 21z','M7 10v.01','M12 7v.01','M17 10v.01'] },
        info:       { p:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','M12 11v6','M12 7.5v.01'] },
        check:      { p:['M4 12l6 6L20 6'] },
        filter:     { p:['M3 4h18','M6 10h12','M10 16h4'] },
        plus:       { p:['M12 5v14','M5 12h14'] },
        minus:      { p:['M5 12h14'] },
        pen:        { p:['M4 20l4-1 12-12-3-3L5 16z','M14 6l3 3'] },
        trash:      { p:['M3 6h18','M8 6V4h8v2','M6 6l1 14h10l1-14','M10 10v6','M14 10v6'] },
        logout:     { p:['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4','M10 17l-5-5 5-5','M5 12h12'] },
        flag:       { p:['M4 21V4','M4 4h14l-2 4 2 4H4'] },
        time:       { p:['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z','M12 6v6l4 2'] }
    };

    function build(name, size) {
        var spec = ICONS[name];
        if (!spec) return null;
        size = size || 20;

        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.classList.add('panel-icon');
        svg.classList.add('panel-icon-' + name);

        var solid = !!spec.s;
        svg.setAttribute('fill', solid ? 'currentColor' : 'none');
        svg.setAttribute('stroke', solid ? 'none' : 'currentColor');
        if (!solid) {
            svg.setAttribute('stroke-width', spec.w || 2);
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
        }

        var paths = spec.p || [];
        for (var i = 0; i < paths.length; i++) {
            var p = document.createElementNS(NS, 'path');
            p.setAttribute('d', paths[i]);
            svg.appendChild(p);
        }
        return svg;
    }

    function svgString(name, size) {
        var n = build(name, size);
        return n ? n.outerHTML : '';
    }

    /* --------------------------------------------------------
       Авто-замена: любые элементы с [data-icon] получают
       SVG-иконку вставленную первым ребёнком.

       Использование в HTML:
           <span data-icon="home">Обзор</span>
           <h2 data-icon="chart">Онлайн</h2>
       -------------------------------------------------------- */
    function autoReplace(root) {
        root = root || document.body;
        var els = root.querySelectorAll('[data-icon]:not([data-icon-done])');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var name = el.getAttribute('data-icon');
            var size = parseInt(el.getAttribute('data-icon-size') || '18', 10);
            var svg = build(name, size);
            if (svg) {
                el.insertBefore(svg, el.firstChild);
                el.setAttribute('data-icon-done', '1');
            }
        }
    }

    function installAutoReplace() {
        autoReplace(document.body);

        if (typeof MutationObserver === 'undefined') return;
        var scheduled = false;
        var mo = new MutationObserver(function (mutations) {
            if (scheduled) return;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
                    scheduled = true;
                    break;
                }
            }
            if (scheduled) {
                setTimeout(function () {
                    scheduled = false;
                    autoReplace(document.body);
                }, 40);
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    window.PanelIcons = {
        element: build,
        svg: svgString,
        has: function (n) { return !!ICONS[n]; },
        names: function () { return Object.keys(ICONS); },
        autoReplace: autoReplace
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installAutoReplace);
    } else {
        installAutoReplace();
    }
})();
