/* ============================================================
   SOVEREIGNTY PANEL · PANEL-DETAIL.JS v1.1
   ============================================================
   Фаза 3 (детализация GUI). Фикс v1.1:
     - Аватарки лидеров используют getHeadAvatar (SVG fallback).
     - Правильный escape ников в SVG-подобных URL.
     - Компактнее delta-бейдж.
   ============================================================ */
(function () {
    'use strict';

    // ============================================================
    // 1. STAT-CARDS — SVG-иконки
    // ============================================================
    var STAT_ICONS = {
        'countries-count': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L3 10 L8 5 L13 10 L13 21 Z"/><path d="M13 21 L13 14 L18 9 L21 11 L21 21 Z"/><path d="M6 12 L6 13 M6 16 L6 17 M16 15 L16 16"/></svg>',
        'total-claims': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 L9 4 L15 7 L21 4 L21 17 L15 20 L9 17 L3 20 Z"/><path d="M9 4 L9 17 M15 7 L15 20"/></svg>',
        'total-bank': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 L12 17 M9.5 9.5 L14.5 9.5 M9.5 14.5 L14.5 14.5"/></svg>',
        'total-energy': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/></svg>',
        'total-players': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 Q2.5 14 9 14 Q15.5 14 15.5 20"/><circle cx="17" cy="7" r="2.5" opacity=".7"/><path d="M17 12.5 Q21 13 21 18" opacity=".7"/></svg>'
    };

    var prevStatValues = {};

    function enhanceStatCards() {
        Object.keys(STAT_ICONS).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var card = el.closest('.stat-card');
            if (!card) return;

            var iconEl = card.querySelector('.stat-icon');
            if (iconEl && !iconEl.dataset.svg) {
                iconEl.dataset.svg = '1';
                iconEl.innerHTML = STAT_ICONS[id];
                iconEl.style.padding = '0';
            }

            var cur = el.textContent;
            var prev = prevStatValues[id];
            prevStatValues[id] = cur;

            if (prev === undefined) return;
            if (prev === cur) return;

            var oldVal = parseStatNumber(prev);
            var newVal = parseStatNumber(cur);
            if (oldVal === null || newVal === null) return;

            var diff = newVal - oldVal;
            if (Math.abs(diff) < 0.5) return;

            var trendEl = card.querySelector('.stat-trend');
            if (!trendEl) {
                trendEl = document.createElement('div');
                trendEl.className = 'stat-trend';
                card.appendChild(trendEl);
            }
            trendEl.classList.remove('up', 'down');
            trendEl.classList.add(diff > 0 ? 'up' : 'down');
            trendEl.textContent = (diff > 0 ? '▲ +' : '▼ −') + formatStatDiff(Math.abs(diff), cur);
        });
    }

    function parseStatNumber(text) {
        if (text == null) return null;
        var s = String(text).trim();
        if (s === '' || s === '—') return null;
        var m = 1;
        if (s.endsWith('M') || s.endsWith('М')) { m = 1e6; s = s.slice(0, -1); }
        else if (s.endsWith('k') || s.endsWith('К')) { m = 1e3; s = s.slice(0, -1); }
        var n = parseFloat(s.replace(/\s/g, '').replace(/,/g, '.'));
        if (isNaN(n)) return null;
        return n * m;
    }

    function formatStatDiff(diff, currentText) {
        var isK = /[kK]/.test(currentText);
        var isM = /[МM]/.test(currentText);
        if (isM) return (diff / 1e6).toFixed(1) + 'M';
        if (isK) {
            if (diff >= 1e6) return (diff / 1e6).toFixed(1) + 'M';
            if (diff >= 1000) return (diff / 1000).toFixed(1) + 'k';
        }
        if (diff >= 1000) return Math.round(diff) + '';
        if (diff < 10 && diff !== Math.floor(diff)) return diff.toFixed(1);
        return Math.round(diff).toString();
    }

    function markLiveStatCards() {
        var data = window.currentData;
        if (!data || !data.updated_at) return;
        var isFresh = (Date.now() - data.updated_at) < 60 * 1000;
        var cards = document.querySelectorAll('.stat-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('is-live', isFresh);
        }
    }

    // ============================================================
    // 2. ТАБЛИЦА СТРАН
    // ============================================================

    function enhanceCountryRows() {
        var tbody = document.getElementById('countries-body');
        if (!tbody) return;
        var rows = tbody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.dataset.enhanced === '1') continue;
            row.dataset.enhanced = '1';

            var dot = row.querySelector('.country-dot');
            if (dot) {
                var color = dot.style.background || '';
                if (color) row.style.setProperty('--row-color', color);
            }

            enhanceOwnerCell(row);
            enhanceDeltaCell(row);
        }
    }

    /** v1.1: аватарка через getHeadAvatar — с SVG fallback, без внешних сервисов. */
    function enhanceOwnerCell(row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        var cell = cells[2];
        if (cell.dataset.enhanced === '1') return;
        var name = cell.textContent.trim();
        if (!name || name === '?') return;

        cell.dataset.enhanced = '1';

        // v1.1: используем window.PanelAvatars.get если есть
        var url;
        if (window.PanelAvatars && window.PanelAvatars.get) {
            url = window.PanelAvatars.get(name, 32);
        } else {
            url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#6366f1"/><text x="16" y="22" text-anchor="middle" font-family="Georgia" font-size="17" font-weight="800" fill="white">' +
                escapeHtml(name.charAt(0).toUpperCase()) + '</text></svg>');
        }

        cell.innerHTML =
            '<span class="cell-owner">' +
                '<img class="cell-owner-img" src="' + escapeAttr(url) + '" ' +
                     'data-pname="' + escapeAttr(name) + '" ' +
                     'alt="" onerror="if(this.dataset.avatarFixed!==\'1\'){this.dataset.avatarFixed=\'1\';this.src=window.PanelAvatars?window.PanelAvatars.svg(\'' + escapeAttr(name) + '\',32):this.src;}">' +
                '<span class="cell-owner-name">' + escapeHtml(name) + '</span>' +
            '</span>';
    }

    /** v1.1: отступы и компактность для delta-бейджа. */
    function enhanceDeltaCell(row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 4) return;
        var cell = cells[3];
        if (cell.dataset.enhanced === '1') return;

        var deltaSpan = cell.querySelector('.delta');
        if (!deltaSpan) return;

        var txt = deltaSpan.textContent;
        var m = txt.match(/\(([+-]?\d+)\)/);
        if (!m) return;
        var delta = parseInt(m[1], 10);
        if (isNaN(delta) || delta === 0) {
            cell.dataset.enhanced = '1';
            // Оставляем как есть
            return;
        }

        cell.dataset.enhanced = '1';

        var mainTxt = (cell.childNodes[0].nodeValue || '').trim();
        var badgeClass = delta > 0 ? 'up' : 'down';
        var arrow = delta > 0 ? '▲' : '▼';
        var sign = delta > 0 ? '+' : '−';

        cell.innerHTML =
            escapeHtml(mainTxt) +
            ' <span class="delta-badge ' + badgeClass + '">' +
                arrow + ' ' + sign + Math.abs(delta) +
            '</span>';
    }

    // ============================================================
    // 3. ЛЕНТА СОБЫТИЙ
    // ============================================================

    var NEW_BADGE_WINDOW_MS = 5 * 60 * 1000;

    function enhanceEventLog() {
        var items = document.querySelectorAll('#event-log-list .event-log-item');
        var now = Date.now();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.dataset.enhanced === '1') continue;
            item.dataset.enhanced = '1';

            var timeEl = item.querySelector('.event-log-time');
            var ts = timeEl ? parseTimeAgo(timeEl.textContent) : null;

            if (ts !== null && (now - ts) < NEW_BADGE_WINDOW_MS && i < 3) {
                var msg = item.querySelector('.event-log-msg');
                if (msg && !msg.querySelector('.event-new-badge')) {
                    msg.insertAdjacentHTML('beforeend', '<span class="event-new-badge">NEW</span>');
                }
            }

            makeCountryLinks(item);
        }
    }

    function parseTimeAgo(text) {
        if (!text) return null;
        text = text.trim().toLowerCase();
        if (text === 'только что') return Date.now();
        var m = text.match(/(\d+)\s*(мин|мин\.|ч|час|дн|день)/);
        if (!m) return null;
        var n = parseInt(m[1], 10);
        var unit = m[2];
        var ms = 0;
        if (unit.startsWith('мин')) ms = n * 60 * 1000;
        else if (unit === 'ч' || unit.startsWith('час')) ms = n * 3600 * 1000;
        else if (unit.startsWith('дн')) ms = n * 24 * 3600 * 1000;
        return Date.now() - ms;
    }

    function makeCountryLinks(item) {
        var msg = item.querySelector('.event-log-msg');
        if (!msg || msg.dataset.linked === '1') return;
        msg.dataset.linked = '1';

        var data = window.currentData;
        if (!data || !data.countries) return;
        var countryNames = data.countries.map(function (c) { return c.name; });
        countryNames.sort(function (a, b) { return b.length - a.length; });

        var html = msg.innerHTML;
        for (var i = 0; i < countryNames.length; i++) {
            var name = countryNames[i];
            if (!name || name.length < 3) continue;
            var escaped = escapeHtml(name);
            var safeRe = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var re = new RegExp('(^|[^\\wа-яА-ЯёЁ])' + safeRe + '($|[^\\wа-яА-ЯёЁ])', 'g');
            html = html.replace(re,
                '$1<span class="country-link" onclick="highlightCountryFromEvent(\'' +
                escapeAttr(name) + '\');event.stopPropagation();">' + escaped + '</span>$2');
        }
        msg.innerHTML = html;
    }

    window.highlightCountryFromEvent = function (countryName) {
        try {
            if (typeof window.gotoCountry === 'function') {
                window.gotoCountry(countryName);
                return;
            }
        } catch (e) {}
    };

    // ============================================================
    // 4. Утилиты
    // ============================================================
    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function escapeAttr(s) {
        return s == null ? '' : String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ============================================================
    // 5. Tick
    // ============================================================
    var lastUpdatedAt = 0;

    function tick() {
        try {
            var data = window.currentData;
            if (data) {
                var newUpdatedAt = data.updated_at;
                enhanceStatCards();
                markLiveStatCards();

                if (newUpdatedAt !== lastUpdatedAt) {
                    lastUpdatedAt = newUpdatedAt;
                    setTimeout(function () {
                        enhanceCountryRows();
                        enhanceEventLog();
                        if (window.PanelAvatars) window.PanelAvatars.refresh();
                    }, 250);
                }
            }
        } catch (e) {
            console.error('[PanelDetail]', e);
        }
        setTimeout(tick, 900);
    }

    function boot() {
        setTimeout(function () {
            enhanceStatCards();
            enhanceCountryRows();
            enhanceEventLog();
            markLiveStatCards();
        }, 500);
        tick();
        console.log('[PanelDetail] v1.1 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelDetail = {
        refresh: function () {
            enhanceStatCards();
            enhanceCountryRows();
            enhanceEventLog();
        }
    };
})();
