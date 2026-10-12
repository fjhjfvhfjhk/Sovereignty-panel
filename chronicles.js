/* ============================================================
   SOVEREIGNTY PANEL · CHRONICLES.JS v1.0
   ============================================================
   Хроники мира — вертикальная лента событий event_log,
   сгруппированная по дням.

   ПОДКЛЮЧЕНИЕ: последним <script> в index.html.
   ============================================================ */
(function () {
    'use strict';

    var ICON_BY_TYPE = {
        war_declared: '⚔️',
        war_ended: '🏆',
        capitulation: '🕊️',
        capital_captured: '🔥',
        npc_capital_captured: '🔥',
        capital_set: '🏛️',
        country_created: '🏛️',
        country_deleted: '🗑️',
        country_renamed: '✏️',
        pact_signed: '🤝',
        jackpot_won: '💎',
        big_win: '💰',
        court_verdict: '⚖️',
        event_started: '🎁',
        event_ended: '🎁',
        event_winner: '🏆',
        boss_killed: '☠️'
    };

    var FILTER_MAP = {
        war:       ['war_declared', 'war_ended', 'capitulation', 'capital_captured', 'npc_capital_captured'],
        country:   ['country_created', 'country_deleted', 'country_renamed', 'capital_set'],
        diplomacy: ['pact_signed', 'court_verdict'],
        event:     ['event_started', 'event_ended', 'event_winner', 'boss_killed']
    };

    var MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                     'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    var currentFilter = 'all';
    var lastUpdatedAt = 0;

    // ============================================================
    // 1. Утилиты
    // ============================================================
    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function filterClass(type) {
        if (FILTER_MAP.war.indexOf(type) !== -1) return 'chr-war';
        if (FILTER_MAP.country.indexOf(type) !== -1) return 'chr-country';
        if (FILTER_MAP.diplomacy.indexOf(type) !== -1) return 'chr-diplomacy';
        if (FILTER_MAP.event.indexOf(type) !== -1) return 'chr-event';
        return 'chr-other';
    }

    function iconFor(type, fallback) {
        return ICON_BY_TYPE[type] || fallback || '•';
    }

    function dayKey(date) {
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }

    function formatDayLabel(date) {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var diff = Math.round((today - d) / 86400000);
        if (diff === 0) return 'Сегодня, ' + d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
        if (diff === 1) return 'Вчера, ' + d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
        if (diff < 7) return diff + ' дн назад, ' + d.getDate() + ' ' + MONTHS_RU[d.getMonth()];
        return d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
    }

    function timeOf(ts) {
        var d = new Date(ts);
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    function matchesFilter(type, filter) {
        if (filter === 'all') return true;
        var list = FILTER_MAP[filter];
        if (!list) return true;
        return list.indexOf(type) !== -1;
    }

    // ============================================================
    // 2. Рендер
    // ============================================================
    function renderChronicles() {
        var feed = document.getElementById('chr-feed');
        if (!feed) return;

        var data = window.currentData;
        if (!data) {
            feed.innerHTML = '<div class="chr-empty">⏳ Загрузка летописи…</div>';
            return;
        }

        var events = data.event_log || [];
        if (events.length === 0) {
            feed.innerHTML = '<div class="chr-empty">Летопись пуста.<br>События появятся здесь по мере жизни мира.</div>';
            return;
        }

        // Фильтр
        var filtered = events.filter(function (e) {
            return matchesFilter(e.type, currentFilter);
        });

        if (filtered.length === 0) {
            feed.innerHTML = '<div class="chr-empty">По этому фильтру ничего нет.</div>';
            return;
        }

        // Группировка по дням
        var groups = {};
        filtered.forEach(function (e) {
            var d = new Date(e.ts);
            var key = dayKey(d);
            if (!groups[key]) groups[key] = { date: d, events: [] };
            groups[key].events.push(e);
        });

        var sorted = Object.values(groups).sort(function (a, b) {
            return b.date - a.date;
        });

        // Собираем HTML
        var html = '';
        sorted.forEach(function (g) {
            html += '<div class="chr-day">';
            html += '<div class="chr-day-header"><span class="chr-day-label">' +
                    escapeHtml(formatDayLabel(g.date)) + '</span></div>';
            html += '<div class="chr-events">';

            g.events.sort(function (a, b) { return b.ts - a.ts; });

            g.events.forEach(function (e) {
                var type = e.type || 'info';
                var cls = filterClass(type);
                var icon = iconFor(type, e.icon);
                html += '<div class="chr-event ' + cls + '">' +
                    '<div class="chr-event-icon">' + escapeHtml(icon) + '</div>' +
                    '<div class="chr-event-body">' +
                        '<div class="chr-event-msg">' + escapeHtml(e.message || '') + '</div>' +
                        '<div class="chr-event-time">' + escapeHtml(timeOf(e.ts)) + '</div>' +
                    '</div>' +
                '</div>';
            });

            html += '</div></div>';
        });

        feed.innerHTML = html;
    }

    // ============================================================
    // 3. Фильтры
    // ============================================================
    function installFilters() {
        var wrap = document.getElementById('chr-filters');
        if (!wrap) return;
        wrap.addEventListener('click', function (e) {
            var btn = e.target.closest('.chr-filter');
            if (!btn) return;
            currentFilter = btn.dataset.filter || 'all';
            wrap.querySelectorAll('.chr-filter').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            renderChronicles();
        });
    }

    // ============================================================
    // 4. Автоперерисовка при обновлении данных
    // ============================================================
    function tickRefresh() {
        try {
            var data = window.currentData;
            if (data && data.updated_at && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                // Небольшая задержка, чтобы другие модули успели обновить DOM
                setTimeout(renderChronicles, 200);
            }
        } catch (e) {}
        setTimeout(tickRefresh, 2000);
    }

    // ============================================================
    // 5. Кнопка в bottom-nav (mobile)
    // ============================================================
    function ensureBottomNavHasChronicles() {
        var nav = document.getElementById('bottom-nav');
        if (!nav) return;
        if (nav.querySelector('[data-tab="chronicles"]')) return;

        var btn = document.createElement('button');
        btn.className = 'bn-btn';
        btn.dataset.tab = 'chronicles';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Хроники');
        btn.innerHTML = '<span class="bn-icon">📜</span><span class="bn-label">Хроники</span>';
        btn.addEventListener('click', function () {
            var topBtn = document.querySelector('.main-nav .nav-btn[data-tab="chronicles"]');
            if (topBtn) topBtn.click();
        });

        var bonus = nav.querySelector('[data-tab="bonus"]');
        if (bonus) nav.insertBefore(btn, bonus);
        else nav.appendChild(btn);
    }

    // ============================================================
    // 6. Boot
    // ============================================================
    function boot() {
        installFilters();
        renderChronicles();
        tickRefresh();

        // Bottom-nav на мобилке рендерится mobile.js — даём ему время
        setTimeout(ensureBottomNavHasChronicles, 500);
        setTimeout(ensureBottomNavHasChronicles, 1500);
        setTimeout(ensureBottomNavHasChronicles, 3000);

        console.log('[Chronicles] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.Chronicles = { refresh: renderChronicles };
})();
