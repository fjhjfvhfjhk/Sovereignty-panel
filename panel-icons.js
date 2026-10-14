/* ============================================================
   SOVEREIGNTY PANEL · PANEL-ICONS.JS v2.2
   ============================================================
   v2.2 (14.10.2026):
     - Перерисован trophy — раньше было 7 путей, которые при
       18px слипались в непонятный флажок. Теперь чистая чаша
       с ручками, ножкой и базой — 4 пути, чётко читается.
     - Перерисован hunt — ромбовидная мишень со стрелами.

   v2.1: +9 иконок (ban, target, window, memo, eye, movie,
         warning, bulb, discord), перерисованы dove/scales/pen/
         landmark/shield/hammer.

   Программно:
     PanelIcons.element('home', 20)  -> DOM node
     PanelIcons.svg('home', 20)      -> SVG string
   ============================================================ */
(function () {
    'use strict';

    var NS = 'http://www.w3.org/2000/svg';

    var ICONS = {
        /* -- Навигация -- */
        home:    { p:['M3 11l9-8 9 8','M5 10v10h5v-6h4v6h5V10'] },
        map:     { p:['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z','M9 4v16','M15 6v16'] },
        users:   { p:['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6','M16 6a3 3 0 0 1 0 6','M21 20c0-3-2-5.5-5-6'] },
        scroll:  { p:['M6 4h11a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z','M8 9h8','M8 13h8','M8 17h5'] },
        book:    { p:['M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2z','M6 2v18'] },
        'book-open': { p:['M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2z','M22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z'] },
        keyboard:{ p:['M3 6h18v12H3z','M6 9h1','M9 9h1','M12 9h1','M15 9h1','M18 9h1','M6 12h1','M9 12h1','M12 12h1','M15 12h1','M18 12h1','M8 15h8'] },
        gift:    { p:['M3 9h18v3H3z','M4 12v9h16v-9','M12 9v12','M8 9a2 2 0 0 1 0-4 4 4 0 0 1 4 4','M16 9a2 2 0 0 0 0-4 4 4 0 0 0-4 4'] },
        grid:    { p:['M3 3h7v7H3z','M14 3h7v7h-7z','M14 14h7v7h-7z','M3 14h7v7H3z'] },

        /* -- Системные -- */
        clock:   { p:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','M12 7v5l3 2'] },
        refresh: { p:['M3 12a9 9 0 0 1 15-6.7L21 8','M21 3v5h-5','M21 12a9 9 0 0 1-15 6.7L3 16','M3 21v-5h5'] },
        theme:   { p:['M12 3a9 9 0 0 0 0 18 4.5 4.5 0 0 0 3-7.8 4.5 4.5 0 0 1 3-7.8A9 9 0 0 0 12 3z'] },
        moon:    { p:['M20 14A8 8 0 1 1 11 5a6.5 6.5 0 0 0 9 9z'] },
        sun:     { p:['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z','M12 1.5v2','M12 20.5v2','M1.5 12h2','M20.5 12h2','M4.6 4.6l1.4 1.4','M18 18l1.4 1.4','M4.6 19.4L6 18','M18 6l1.4-1.4'] },

        /* -- Метрики -- */
        landmark: { p:[
            'M3 21h18',
            'M5 21V10h14v11',
            'M9 21V10',
            'M15 21V10',
            'M12 5l7 5H5z'
        ], w:1.8 },
        castle:  { p:[
            'M3 22V9h3V6h3v3h2V6h2v3h2V6h2v3h3v13',
            'M10 22v-5a2 2 0 0 1 4 0v5'
        ], w:1.8 },
        bank:    { p:[
            'M3 22h18',
            'M5 22V11h14v11',
            'M9 22V11',
            'M15 22V11',
            'M3 11l9-5 9 5',
            'M9 15h6'
        ], w:1.8 },
        money:   { p:['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'] },
        'money-out': { p:['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6','M17 15l5 5','M22 15l-5 5'] },
        bolt:    { p:['M13 2L4 14h6l-1 8 9-12h-6z'] },
        chart:   { p:['M4 20V10','M10 20V4','M16 20v-8','M22 20H2'] },
        'chart-down': { p:['M4 4v16h18','M8 8l4 4 4-2 4 4'] },

        /* -- Trophy: чистая чаша, читаемая с 16px -- */
        trophy:  { p:[
            'M7 4h10v6a5 5 0 0 1-10 0z',
            'M7 6H4a3 3 0 0 0 3 3',
            'M17 6h3a3 3 0 0 1-3 3',
            'M11 15h2v4h-2z',
            'M8 19h8v2H8z'
        ], w:1.8 },

        sparkles:{ p:['M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z','M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z','M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z'] },
        sprout:  { p:['M12 22V11','M12 11a5 5 0 0 0 5-5V2a5 5 0 0 0-5 5z','M12 13a5 5 0 0 1-5-5V4a5 5 0 0 1 5 5z'] },
        eye:     { p:['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z','M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], w:1.8 },
        target:  { p:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z','M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'], w:1.8 },
        bulb:    { p:['M9 18h6','M10 21h4','M8 14a5 5 0 1 1 8 0c-1 1-1.5 2-1.5 3h-5c0-1-.5-2-1.5-3z','M12 8v3'], w:1.8 },

        /* -- Действия -- */
        war:     { p:['M4 4l16 16','M20 4L4 20'] },
        handshake:{ p:['M11 17l-2-2a2 2 0 0 1 0-3l3-3 4 4-3 3','M2 12l4-4 3 3','M22 12l-4-4-3 3','M9 15l4 4 3-3'] },
        crown:   { p:['M3 19h18v2H3z','M3 19L2 8l5 3 5-7 5 7 5-3-1 11z'] },
        anchor:  { p:['M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z','M12 7v13','M8 11h8','M5 14H2a10 10 0 0 0 20 0h-3'], w:2.2 },
        star:    { p:['M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.7L12 16.9 5.8 20.2l1.6-6.7L2.2 8.9l6.9-.6z'] },
        flame:   { p:['M12 2c2 5 6 7 6 12a6 6 0 1 1-12 0c0-3 2-5 4-7 0 2 1 3 2 3z'] },
        snow:    { p:['M12 2v20','M3 12h18','M5 5l14 14','M19 5L5 19'], w:2.4 },
        wave:    { p:['M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0','M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0','M2 20c2-3 4-3 6 0s4 3 6 0 4-3 6 0'], w:2.2 },
        tree:    { s:true, p:['M12 1l-5 7h3l-5 8h5v7h4v-7h5l-5-8h3z'] },
        cactus:  { p:['M12 22V7a3 3 0 0 1 6 0v15z','M12 11H9a2 2 0 0 1-2-2V7h2v2h3','M18 13h3a2 2 0 0 0 2-2V9h-2v2h-3'] },
        wheat:   { p:['M12 22V8','M12 8a2 2 0 0 0-2-2V4a2 2 0 0 0 4 0v2a2 2 0 0 0-2 2z','M12 12a2 2 0 0 0-2-2V8a2 2 0 0 0 4 0v2a2 2 0 0 0-2 2z','M12 16a2 2 0 0 0-2-2v-2a2 2 0 0 0 4 0v2a2 2 0 0 0-2 2z'] },
        sword:   { p:['M14 4l6-2-2 6L8 18l-4 2 2-4z','M4 20l2-2','M10 16l-4-4'] },
        shield:  { p:['M12 2l8 2v8c0 5-3.5 9-8 10-4.5-1-8-5-8-10V4z','M9 12l2 2 4-4'] },
        cross:   { s:true, p:['M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z'] },
        key:     { p:['M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M10 10l10 10-2 2-2-2-2 2-2-2'] },
        hammer:  { s:true, p:['M15 3l6 6-2.5 2.5-6-6z','M13 5L3 15l6 6 10-10z'] },
        chalice: { s:true, p:['M7 3h10v4a5 5 0 0 1-4 4.9V17h4v2H7v-2h4v-5.1A5 5 0 0 1 7 7z'] },
        pickaxe: { p:['M3 21l9-9','M11 3c4 0 8 2 10 6-4-2-8-2-12 0z','M15 7l6 6'] },
        gem:     { p:['M6 3h12l3 6-9 12L3 9z','M3 9h18','M9 9l3-6 3 6','M12 9v12'] },
        treasure:{ p:['M3 10h18v11H3z','M3 10l2-4h14l2 4','M12 10v11','M10 15h4v4h-4z'] },
        chest:   { p:['M3 10h18v11H3z','M3 10l2-4h14l2 4','M12 10v3','M10 14h4v3h-4z'] },

        /* -- Люди / группы -- */
        group:   { p:['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6','M16 6a3 3 0 0 1 0 6','M21 20c0-3-2-5.5-5-6'] },

        /* -- Hunt: мишень со стрелами (перерисовано в v2.2) -- */
        hunt:    { p:[
            'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
            'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
            'M12 2v3',
            'M12 19v3',
            'M2 12h3',
            'M19 12h3'
        ], w:1.8 },

        /* -- Дипломатия -- */
        scales:  { p:[
            'M12 3v16',
            'M6 21h12',
            'M3 6h18',
            'M6 6l-3 6a3 3 0 0 0 6 0z',
            'M18 6l-3 6a3 3 0 0 0 6 0z'
        ], w:1.8 },
        dove:    { p:[
            'M22 4c-2.5.3-4.7-.2-6.3-1.5L13 7l-4-3-3 4 3 2-6 6 6-1 1 5c4-3 8-9 8-13l4-3z',
            'M17 5.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z'
        ], w:1.8 },
        speech:  { p:['M3 5h18v11H8l-5 5z'] },
        clipboard:{ p:['M8 3h8v3H8z','M5 4h3v2h8V4h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z','M9 12h6','M9 16h4'] },

        /* -- Смерть / казино -- */
        skull:   { p:['M12 2C8 2 5 5 5 9c0 2 .5 3.5 1.5 5v4c0 1 .5 2 2 2h7c1.5 0 2-1 2-2v-4c1-1.5 1.5-3 1.5-5 0-4-3-7-7-7z','M9 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z','M15 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z','M11 14h2v2l-1 1-1-1z'] },
        casino:  { p:['M3 3h18v18H3z','M7.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M16.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M12 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M7.5 17.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M16.5 17.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'] },

        /* -- Учёба -- */
        microscope: { p:['M6 18h12','M8 18v-3a4 4 0 0 1 8 0v3','M10 8h6l-2-3h-2z','M12 8v7'] },
        construction: { p:['M2 22h20','M4 22l3-12h10l3 12','M10 10V4a2 2 0 0 1 4 0v6','M14 10h6'] },

        /* -- Магазин -- */
        shop:    { p:['M3 9l2-6h14l2 6','M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0','M5 12v9h14v-9','M10 21v-5h4v5'] },
        cart:    { p:['M3 4h2l2 12h12','M6 8h15l-2 8H6','M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z','M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'] },

        /* -- v2.1 -- */
        ban:     { p:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','M5.6 5.6l12.8 12.8'], w:2 },
        window:  { p:['M3 4h18v16H3z','M3 9h18','M12 9v11','M7 6.5h.01','M10 6.5h.01'], w:1.8 },
        memo:    { p:['M5 3h10l5 5v13H5z','M15 3v5h5','M8 12h8','M8 16h5'], w:1.8 },
        movie:   { p:['M3 4h18v16H3z','M3 9h18','M3 15h18','M8 4v5','M16 4v5','M8 15v5','M16 15v5'], w:1.8 },
        warning: { p:['M12 3l10 18H2z','M12 10v5','M12 18v.01'], w:1.8 },

        /* -- Discord -- */
        discord: { s:true, p:[
            'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.74 19.74 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'
        ] },

        /* -- Прочее -- */
        arrowright: { p:['M5 12h14','M13 6l6 6-6 6'] },
        arrowup:    { p:['M12 5v14','M6 11l6-6 6 6'] },
        close:      { p:['M6 6l12 12','M18 6L6 18'] },
        search:     { p:['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.4-4.4'] },
        palette:    { p:['M12 21a9 9 0 1 1 0-18c5 0 9 3.5 9 8 0 2.5-2 4-4 4h-2a2 2 0 0 0-1.5 3.4A2 2 0 0 1 12 21z','M7 10v.01','M12 7v.01','M17 10v.01'] },
        image:      { p:['M3 3h18v18H3z','M3 17l5-5 4 4 3-3 6 6','M9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'] },
        info:       { p:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','M12 11v6','M12 7.5v.01'] },
        check:      { p:['M4 12l6 6L20 6'] },
        filter:     { p:['M3 4h18','M6 10h12','M10 16h4'] },
        plus:       { p:['M12 5v14','M5 12h14'] },
        minus:      { p:['M5 12h14'] },
        pen:        { p:['M4 20l4-1 12-12-3-3L5 16z','M14 5l5 5','M3 21l1-5 5-1z'], w:1.8 },
        trash:      { p:['M3 6h18','M8 6V4h8v2','M6 6l1 14h10l1-14','M10 10v6','M14 10v6'] },
        logout:     { p:['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4','M10 17l-5-5 5-5','M5 12h12'] },
        flag:       { p:['M4 21V4','M4 4h14l-2 4 2 4H4'] },
        time:       { p:['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z','M12 6v6l4 2'] },
        'map-pin':  { p:['M12 22s-8-8-8-13a8 8 0 0 1 16 0c0 5-8 13-8 13z','M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'] },
        compass:    { p:['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z','M16 8l-2 6-6 2 2-6z'] },
        mountains:  { p:['M2 20l6-10 4 6 3-4 7 8z'] },
        boom:       { p:['M12 2l1 4 4-2 1 4 4 1-2 3 3 3-4 2 2 4-4-1-2 3-3-3-3 3-2-3-4 1 2-4-4-2 3-3-2-3 4-1 1-4 4 2z'] }
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
