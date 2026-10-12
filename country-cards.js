/* ============================================================
   SOVEREIGNTY PANEL · COUNTRY-CARDS.JS v1.0
   ============================================================
   Автономный рендер «Топ стран» карточками.

   ЗАЧЕМ ЭТОТ МОДУЛЬ, ЕСЛИ ЕСТЬ mobile.js:
     В mobile.js рендер карточек срабатывает не всегда — зависит от
     порядка загрузки скриптов, кэша браузера и того, был ли
     window.renderCountries определён на момент installCountryCardsHook().
     Результат — на десктопе контейнер #country-cards-mobile оставался
     пустым, а таблица была скрыта через country-cards.css → панель
     «Топ стран» оказывалась полностью пустой.

   ЧТО ДЕЛАЕТ ЭТОТ МОДУЛЬ:
     1. Создаёт #country-cards-mobile независимо от mobile.js.
     2. Рендерит карточки на ВСЕХ разрешениях (не только на мобилке).
     3. Следит за изменениями #countries-body через MutationObserver —
        каждый раз, когда app.js/panel-detail.js перерисовывают таблицу,
        карточки обновляются автоматически.
     4. Дополнительно инжектит SVG-иконки в .stat-icon — на случай,
        если panel-detail.js по какой-то причине не сработал.

   ПОДКЛЮЧЕНИЕ: последним <script> в index.html.

     <script src="country-cards.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    // ============================================================
    // 1. SVG-иконки для stat-карточек
    // ============================================================
    var SVG_ICONS = {
        'countries-count': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L3 10 L8 5 L13 10 L13 21 Z"/><path d="M13 21 L13 14 L18 9 L21 11 L21 21 Z"/><path d="M6 12 L6 13 M6 16 L6 17 M16 15 L16 16"/></svg>',
        'total-claims': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 L9 4 L15 7 L21 4 L21 17 L15 20 L9 17 L3 20 Z"/><path d="M9 4 L9 17 M15 7 L15 20"/></svg>',
        'total-bank': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 L12 17 M9.5 9.5 L14.5 9.5 M9.5 14.5 L14.5 14.5"/></svg>',
        'total-energy': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/></svg>',
        'total-players': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 Q2.5 14 9 14 Q15.5 14 15.5 20"/><circle cx="17" cy="7" r="2.5" opacity=".7"/><path d="M17 12.5 Q21 13 21 18" opacity=".7"/></svg>'
    };

    function injectSvgs() {
        Object.keys(SVG_ICONS).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var card = el.closest('.stat-card');
            if (!card) return;
            var icon = card.querySelector('.stat-icon');
            if (!icon) return;

            // Если уже вставлен наш SVG — не трогаем.
            if (icon.querySelector('svg')) return;

            // Если panel-detail.js уже поставил свой флаг — тоже не трогаем,
            // чтобы не мигать.
            if (icon.dataset.svg === '1' && icon.querySelector('svg')) return;

            icon.innerHTML = SVG_ICONS[id];
            icon.dataset.svg = '1';
            icon.style.padding = '0';
        });
    }

    // ============================================================
    // 2. Утилиты
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

    function formatMoney(a) {
        if (a == null) return '0';
        var abs = Math.abs(a);
        if (abs >= 1000000) return (a / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (a / 1000).toFixed(1) + 'k';
        return Math.round(a).toString();
    }

    // ============================================================
    // 3. Контейнер карточек
    // ============================================================
    function ensureContainer() {
        var tbody = document.getElementById('countries-body');
        if (!tbody) return null;

        var existing = document.getElementById('country-cards-mobile');
        if (existing) return existing;

        var wrap = tbody.closest('.table-wrap');
        var parent = wrap ? wrap.parentNode : tbody.closest('.panel');
        if (!parent) return null;

        var container = document.createElement('div');
        container.id = 'country-cards-mobile';
        container.className = 'country-cards-mobile';

        if (wrap && wrap.nextSibling) {
            parent.insertBefore(container, wrap.nextSibling);
        } else if (wrap) {
            parent.appendChild(container);
        } else {
            parent.appendChild(container);
        }
        return container;
    }

    // ============================================================
    // 4. Рендер
    // ============================================================
    function renderCards() {
        var container = ensureContainer();
        if (!container) return;

        var data = window.currentData;
        if (!data) return;

        var countries = (data.countries || []).slice();
        var sortMode = window.currentSort || 'claims';

        countries.sort(function (a, b) {
            if (sortMode === 'bank') return (b.bank || 0) - (a.bank || 0);
            if (sortMode === 'energy') return (b.energy || 0) - (a.energy || 0);
            if (sortMode === 'allies') return (b.allies || 0) - (a.allies || 0);
            if (sortMode === 'activity') return (b.activity || 0) - (a.activity || 0);
            return (b.claims || 0) - (a.claims || 0);
        });

        if (countries.length === 0) {
            container.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">Пока нет стран.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < countries.length; i++) {
            html += buildCard(countries[i], i);
        }
        container.innerHTML = html;

        if (window.PanelAvatars && window.PanelAvatars.refresh) {
            setTimeout(window.PanelAvatars.refresh, 60);
        }
    }

    function buildCard(c, idx) {
        var rank = idx + 1;
        var rankCls = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        var color = c.color || '#6366f1';
        var ownerName = String(c.owner || '?');

        var avatarSrc;
        if (window.PanelAvatars && window.PanelAvatars.get) {
            avatarSrc = window.PanelAvatars.get(ownerName, 32);
        } else {
            var letter = ownerName.charAt(0).toUpperCase();
            avatarSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
                    '<rect width="32" height="32" rx="4" fill="#6366f1"/>' +
                    '<text x="16" y="22" text-anchor="middle" font-family="Georgia" ' +
                           'font-size="17" font-weight="800" fill="white">' + letter + '</text>' +
                '</svg>');
        }

        var claims = c.claims || 0;
        var maxClaims = c.max_claims != null ? c.max_claims : '?';
        var delta = c.claims_delta_7d || 0;
        var deltaCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        var deltaStr = delta > 0 ? '▲ +' + delta
                     : delta < 0 ? '▼ −' + Math.abs(delta)
                     : '0';

        var capIcon = c.capital ? ' 🏛️' : '';
        var activity = c.activity || 0;
        var pacts = c.pacts || 0;

        return '<article class="ccm-card" ' +
                'style="--row-color:' + escapeAttr(color) + ';" ' +
                'onclick="if(typeof showDetails===\'function\')showDetails(\'' + escapeAttr(c.name) + '\')">' +
            '<div class="ccm-head">' +
                '<div class="ccm-rank ' + rankCls + '">#' + rank + '</div>' +
                '<div class="ccm-name-block">' +
                    '<div class="ccm-name">' + escapeHtml(c.name || '?') + capIcon + '</div>' +
                    '<div class="ccm-owner">' +
                        '<img class="ccm-avatar" src="' + escapeAttr(avatarSrc) + '" ' +
                             'data-avatar-name="' + escapeAttr(ownerName) + '" alt="">' +
                        '<span>' + escapeHtml(ownerName) + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="ccm-stats">' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Чанков</span>' +
                    '<span class="ccm-stat-value">' + claims + ' / ' + maxClaims + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Казна</span>' +
                    '<span class="ccm-stat-value money">' + formatMoney(c.bank || 0) + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Энергия</span>' +
                    '<span class="ccm-stat-value energy">' + (c.energy || 0).toFixed(1) + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Рост 7д</span>' +
                    '<span class="ccm-stat-value delta ' + deltaCls + '">' + deltaStr + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Активность</span>' +
                    '<span class="ccm-stat-value">' + activity + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Пакты</span>' +
                    '<span class="ccm-stat-value">' + pacts + '</span>' +
                '</div>' +
            '</div>' +
        '</article>';
    }

    // ============================================================
    // 5. Автообновление — следим за изменениями #countries-body
    // ============================================================
    function hookObserver() {
        var tbody = document.getElementById('countries-body');
        if (!tbody) return;
        if (tbody.dataset.ccObserver === '1') return;
        tbody.dataset.ccObserver = '1';

        var mo = new MutationObserver(function () {
            // Небольшая задержка, чтобы app.js/panel-detail.js успели
            // дорисовать свои элементы, если они были в цепочке.
            setTimeout(renderCards, 30);
        });
        mo.observe(tbody, { childList: true, subtree: false });
    }

    // ============================================================
    // 6. Boot
    // ============================================================
    function boot() {
        ensureContainer();
        injectSvgs();
        hookObserver();

        // Первичный рендер — с несколькими попытками, потому что JSON
        // может прийти позже, чем DOM.
        setTimeout(renderCards, 200);
        setTimeout(function () { injectSvgs(); renderCards(); }, 800);
        setTimeout(function () { injectSvgs(); renderCards(); }, 2000);
        setTimeout(function () { injectSvgs(); renderCards(); }, 4000);

        console.log('[CountryCards] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Публичный API
    window.CountryCards = {
        refresh: renderCards,
        injectSvgs: injectSvgs
    };
})();
