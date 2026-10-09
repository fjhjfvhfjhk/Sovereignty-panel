/* ============================================================
   SOVEREIGNTY PANEL · PANEL-DETAIL.JS v1.0
   ============================================================
   Фаза 3 (детализация GUI).

   Что делает:
     1. Обогащает stat-карточки трендом (рост/падение за сутки)
        и pulse-индикатором живых данных.
     2. Считает дельту и красит цветной полоской слева от строки
        в таблице стран.
     3. Обогащает ленту событий: ссылки на страны, бейдж "НОВОЕ",
        разбор времени.
     4. Оборачивает аватарки лидеров в ячейке таблицы стран.
     5. Строит SVG-иконки для stat-карточек (если не были).

   Подключать ПОСЛЕ panel-loading.js:
     <script src="panel-loading.js?v=1.0"></script>
     <script src="panel-detail.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    // ============================================================
    // 1. STAT-CARDS — SVG-иконки, тренд, pulse
    // ============================================================

    // Заменяем эмодзи-иконки на SVG в бренд-цвете
    var STAT_ICONS = {
        'countries-count': {
            svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L3 10 L8 5 L13 10 L13 21 Z"/><path d="M13 21 L13 14 L18 9 L21 11 L21 21 Z"/><path d="M6 12 L6 13 M6 16 L6 17 M16 15 L16 16"/></svg>'
        },
        'total-claims': {
            svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 L9 4 L15 7 L21 4 L21 17 L15 20 L9 17 L3 20 Z"/><path d="M9 4 L9 17 M15 7 L15 20"/></svg>'
        },
        'total-bank': {
            svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 L12 17 M9.5 9.5 L14.5 9.5 M9.5 14.5 L14.5 14.5"/><path d="M9.5 9.5 Q9.5 7 12 7 Q14.5 7 14.5 9 Q14.5 11 12 11 Q9.5 11 9.5 13 Q9.5 15 12 15 Q14.5 15 14.5 12.5" opacity=".55"/></svg>'
        },
        'total-energy': {
            svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/></svg>'
        },
        'total-players': {
            svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 Q2.5 14 9 14 Q15.5 14 15.5 20"/><circle cx="17" cy="7" r="2.5" opacity=".7"/><path d="M17 12.5 Q21 13 21 18" opacity=".7"/></svg>'
        }
    };

    var prevStatValues = {};

    /**
     * Замена эмодзи-иконок на SVG + добавление тренда.
     */
    function enhanceStatCards() {
        Object.keys(STAT_ICONS).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var card = el.closest('.stat-card');
            if (!card) return;

            // SVG-иконка
            var iconEl = card.querySelector('.stat-icon');
            if (iconEl && !iconEl.dataset.svg) {
                iconEl.dataset.svg = '1';
                iconEl.innerHTML = STAT_ICONS[id].svg;
                iconEl.style.padding = '0';
            }

            // Значение + тренд
            var cur = el.textContent;
            var prev = prevStatValues[id];
            prevStatValues[id] = cur;

            if (prev === undefined) return;       // первый рендер
            if (prev === cur) return;             // ничего не изменилось

            // Обновляем тренд
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
            trendEl.classList.remove('up', 'down', 'flat');
            var arrow = diff > 0 ? '▲' : '▼';
            var sign = diff > 0 ? '+' : '';
            trendEl.classList.add(diff > 0 ? 'up' : 'down');
            trendEl.textContent = arrow + ' ' + sign + formatStatDiff(diff, cur);
        });
    }

    function parseStatNumber(text) {
        if (text == null) return null;
        var s = String(text).trim();
        if (s === '' || s === '—' || s === '···') return null;

        var multiplier = 1;
        if (s.endsWith('M') || s.endsWith('М')) { multiplier = 1e6; s = s.slice(0, -1); }
        else if (s.endsWith('k') || s.endsWith('К')) { multiplier = 1e3; s = s.slice(0, -1); }

        var clean = s.replace(/\s/g, '').replace(/,/g, '.');
        var num = parseFloat(clean);
        if (isNaN(num)) return null;
        return num * multiplier;
    }

    function formatStatDiff(diff, currentText) {
        // Если значение в тексте выглядит как "16.1k", "+2" не будет понятно.
        // Дадим в тех же единицах.
        var isK = /[kK]/.test(currentText);
        var isM = /[МM]/.test(currentText);

        var abs = Math.abs(diff);
        if (isM) return (abs / 1e6).toFixed(1) + 'M';
        if (isK) {
            if (abs >= 1e6) return (abs / 1e6).toFixed(1) + 'M';
            if (abs >= 1000) return (abs / 1000).toFixed(1) + 'k';
        }
        if (abs >= 1000) return Math.round(abs) + '';
        if (abs < 10 && abs !== Math.floor(abs)) return abs.toFixed(1);
        return Math.round(abs).toString();
    }

    /**
     * Pulse-индикатор на stat-card со свежими данными (обновлено <60 сек).
     */
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
    // 2. ТАБЛИЦА СТРАН — цветная полоска, аватар, дельта
    // ============================================================

    function enhanceCountryRows() {
        var tbody = document.getElementById('countries-body');
        if (!tbody) return;
        var rows = tbody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.dataset.enhanced === '1') continue;
            row.dataset.enhanced = '1';

            // Цветная полоска слева = цвет страны
            var dot = row.querySelector('.country-dot');
            if (dot) {
                var color = dot.style.background || '';
                if (color) row.style.setProperty('--row-color', color);
            }

            // Ячейка лидера → оборачиваем аватарку + ник
            enhanceOwnerCell(row);

            // Дельта 7д → бейдж
            enhanceDeltaCell(row);
        }
    }

    function enhanceOwnerCell(row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        var cell = cells[2];
        if (cell.dataset.enhanced === '1') return;
        var name = cell.textContent.trim();
        if (!name || name === '?') return;

        cell.dataset.enhanced = '1';
        cell.innerHTML =
            '<span class="cell-owner">' +
                '<img class="cell-owner-img" ' +
                     'src="https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/32" ' +
                     'onerror="this.onerror=null;this.style.opacity=0.3;" ' +
                     'alt="">' +
                '<span class="cell-owner-name">' + escapeHtml(name) + '</span>' +
            '</span>';
    }

    function enhanceDeltaCell(row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 4) return;
        var cell = cells[3];
        if (cell.dataset.enhanced === '1') return;

        // Ищем span.delta
        var deltaSpan = cell.querySelector('.delta');
        if (!deltaSpan) return;

        var txt = deltaSpan.textContent;   // "(+2)" или "(-3)" или "(0)"
        var m = txt.match(/\(([+-]?\d+)\)/);
        if (!m) return;
        var delta = parseInt(m[1], 10);
        if (isNaN(delta)) return;

        cell.dataset.enhanced = '1';

        // Отделяем "42 / 15" от дельты
        var mainTxt = cell.childNodes[0].nodeValue || '';
        mainTxt = mainTxt.trim();

        var badgeClass = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
        var arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
        var sign = delta > 0 ? '+' : '';

        cell.innerHTML =
            escapeHtml(mainTxt) +
            ' <span class="delta-badge ' + badgeClass + '">' +
                arrow + ' ' + sign + delta +
            '</span>';
    }

    // ============================================================
    // 3. ЛЕНТА СОБЫТИЙ — ссылки на страны, бейдж NEW
    // ============================================================

    // Ограничение: только 3 самых свежих события могут получить бейдж NEW
    var NEW_BADGE_WINDOW_MS = 5 * 60 * 1000;

    function enhanceEventLog() {
        var items = document.querySelectorAll('#event-log-list .event-log-item');
        var now = Date.now();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.dataset.enhanced === '1') continue;
            item.dataset.enhanced = '1';

            // Разбор "N мин назад" / "только что" в ts (если можем)
            var timeEl = item.querySelector('.event-log-time');
            var ts = null;
            if (timeEl) {
                ts = parseTimeAgo(timeEl.textContent);
            }

            // Свежие — бейдж NEW
            if (ts !== null && (now - ts) < NEW_BADGE_WINDOW_MS && i < 3) {
                var msg = item.querySelector('.event-log-msg');
                if (msg && !msg.querySelector('.event-new-badge')) {
                    msg.insertAdjacentHTML('beforeend', '<span class="event-new-badge">NEW</span>');
                }
            }

            // Превращаем имена стран в ссылки
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

        var html = msg.innerHTML;
        countryNames.sort(function (a, b) { return b.length - a.length; });

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

    // ============================================================
    // 4. Публичный обработчик клика по стране в событии
    // ============================================================

    window.highlightCountryFromEvent = function (countryName) {
        try {
            if (typeof window.gotoCountry === 'function') {
                window.gotoCountry(countryName);
                return;
            }
            if (typeof window.highlightCountry === 'function') {
                window.highlightCountry(countryName);
                // Переходим на вкладку карты
                var mapBtn = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
                if (mapBtn) mapBtn.click();
                return;
            }
        } catch (e) {}
        // Fallback: ничего не делаем
    };

    // ============================================================
    // 5. Утилиты (свои, чтобы не зависеть от app.js)
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
    // 6. Регулярная обработка
    // ============================================================

    var lastUpdatedAt = 0;

    function tick() {
        try {
            var data = window.currentData;
            if (data) {
                var newUpdatedAt = data.updated_at;

                // Stat-cards (enhance каждый тик — дешёво)
                enhanceStatCards();
                markLiveStatCards();

                // Если данные обновились — переобрабатываем DOM-таблицы
                if (newUpdatedAt !== lastUpdatedAt) {
                    lastUpdatedAt = newUpdatedAt;
                    setTimeout(function () {
                        enhanceCountryRows();
                        enhanceEventLog();
                    }, 250);
                }
            }
        } catch (e) {
            console.error('[PanelDetail]', e);
        }
        setTimeout(tick, 900);
    }

    // ============================================================
    // Boot
    // ============================================================

    function boot() {
        // Первый прогон — с задержкой, чтобы app.js успел отрендерить
        setTimeout(function () {
            enhanceStatCards();
            enhanceCountryRows();
            enhanceEventLog();
            markLiveStatCards();
        }, 500);

        tick();
        console.log('[PanelDetail] v1.0 ready');
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
