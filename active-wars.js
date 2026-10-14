/* ============================================================
   SOVEREIGNTY PANEL · ACTIVE-WARS.JS v1.1
   ============================================================
   v1.1 (14.10.2026):
     - Заголовок "Активные войны" — SVG war вместо ⚔.
     - Каждая строка войны — SVG war вместо ⚔.
   ============================================================ */
(function () {
    'use strict';

    var lastUpdatedAt = 0;

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function escapeAttr(s) {
        return s == null ? '' : String(s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function pluralDays(n) {
        var mod10 = n % 10;
        var mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return n + ' день';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return n + ' дня';
        return n + ' дней';
    }

    function buildWarIcon() {
        if (window.PanelIcons && window.PanelIcons.element) {
            var svg = window.PanelIcons.element('war', 20);
            if (svg) return svg.outerHTML;
        }
        return '';
    }

    // ============================================================
    // 1. Контейнер
    // ============================================================
    function ensureContainer() {
        if (document.getElementById('active-wars-panel')) return;

        var topCountries = document.querySelector('#tab-overview .overview-main > .panel:nth-of-type(2)');
        if (!topCountries) return;

        var panel = document.createElement('section');
        panel.id = 'active-wars-panel';
        panel.className = 'panel active-wars-panel';
        panel.style.display = 'none';
        panel.innerHTML =
            '<div class="panel-header">' +
                '<h2 data-icon="war">Активные войны</h2>' +
            '</div>' +
            '<div class="active-wars-list" id="active-wars-list"></div>';

        topCountries.parentNode.insertBefore(panel, topCountries);

        if (window.PanelIcons && window.PanelIcons.autoReplace) {
            window.PanelIcons.autoReplace(panel);
        }
    }

    // ============================================================
    // 2. Рендер
    // ============================================================
    function render() {
        ensureContainer();
        var panel = document.getElementById('active-wars-panel');
        var list = document.getElementById('active-wars-list');
        if (!panel || !list) return;

        var data = window.currentData;
        if (!data) return;

        var wars = data.wars || [];
        if (wars.length === 0) {
            panel.style.display = 'none';
            list.innerHTML = '';
            return;
        }

        panel.style.display = 'block';
        var iconHtml = buildWarIcon();

        list.innerHTML = wars.map(function (w) {
            var attacker = w.attacker || '?';
            var defender = w.defender || '?';
            var days = w.duration_days || 0;
            var duration = pluralDays(days);

            return '<div class="aw-item" onclick="if(typeof openCountryPassport===\'function\')openCountryPassport(\'' +
                    escapeAttr(attacker) + '\')">' +
                '<div class="aw-icon">' + iconHtml + '</div>' +
                '<div class="aw-body">' +
                    '<div class="aw-title"><b>' + escapeHtml(attacker) + '</b> против <b>' +
                        escapeHtml(defender) + '</b></div>' +
                    '<div class="aw-meta">Идёт уже ' + duration + '</div>' +
                '</div>' +
                '<div class="aw-duration">' + duration + '</div>' +
            '</div>';
        }).join('');
    }

    // ============================================================
    // 3. Tick
    // ============================================================
    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(render, 350);
            }
        } catch (e) {}
        setTimeout(tick, 2000);
    }

    // ============================================================
    // 4. Boot
    // ============================================================
    function boot() {
        ensureContainer();
        setTimeout(render, 700);
        setTimeout(render, 1800);
        tick();
        console.log('[ActiveWars] v1.1 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.ActiveWars = { refresh: render };
})();
