/* ============================================================
   SOVEREIGNTY PANEL · EVENT-LOG-24H.JS v1.0
   ============================================================
   Фильтр ленты событий на главной странице — только за 24 часа.

   ЗАЧЕМ:
     С появлением вкладки «📜 Хроники» (полная летопись с фильтрами)
     дублировать полный список на главной нет смысла. Оставляем
     только свежие события — что произошло «сегодня».

   КАК РАБОТАЕТ:
     Поллим currentData.updated_at каждые 1.5 сек. Как только
     данные обновились — перерисовываем #event-log-list с 24-часовым
     фильтром. Не трогаем app.js и не пытаемся переопределить
     его renderEventLog (был бы риск гонок с safeRender).

   ПОДКЛЮЧЕНИЕ: последним <script> в index.html.
   ============================================================ */
(function () {
    'use strict';

    var TTL_MS = 24 * 3600 * 1000;
    var MAX_DISPLAY = 20;
    var lastRenderedUpdatedAt = 0;

    // ============================================================
    // 1. Утилиты
    // ============================================================
    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function timeAgo(ts) {
        if (!ts) return '';
        var s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'только что';
        var m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
        var h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
        return Math.floor(h / 24) + ' дн назад';
    }

    // ============================================================
    // 2. Рендер
    // ============================================================
    function renderLast24h() {
        var list = document.getElementById('event-log-list');
        if (!list) return;

        var data = window.currentData;
        if (!data) return;

        var events = data.event_log || [];
        var now = Date.now();

        var recent = events.filter(function (e) {
            return e && typeof e.ts === 'number' && (now - e.ts) < TTL_MS;
        });

        if (recent.length === 0) {
            list.innerHTML = '<div class="event-log-empty">' +
                'За последние 24 часа событий не было.' +
                '<br><small style="opacity:.7;">' +
                'Полная летопись — во вкладке 📜 Хроники' +
                '</small></div>';
            return;
        }

        var display = recent.slice(0, MAX_DISPLAY);
        list.innerHTML = display.map(function (e) {
            var typeClass = 'event-type-' + (e.type || 'info');
            return '<div class="event-log-item ' + typeClass + '">' +
                '<div class="event-log-icon">' + escapeHtml(e.icon || '•') + '</div>' +
                '<div class="event-log-body">' +
                    '<div class="event-log-msg">' + escapeHtml(e.message || '') + '</div>' +
                    '<div class="event-log-time">' + timeAgo(e.ts) + '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        // Обновляем футер со ссылкой на полную летопись
        // (вставляем один раз)
        if (!list.nextElementSibling || !list.nextElementSibling.classList.contains('event-log-more')) {
            var more = document.createElement('div');
            more.className = 'event-log-more';
            more.innerHTML = '<a href="#" id="event-log-more-link">📜 Полная летопись →</a>';
            list.parentNode.insertBefore(more, list.nextSibling);
            var link = document.getElementById('event-log-more-link');
            if (link) {
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    var btn = document.querySelector('.main-nav .nav-btn[data-tab="chronicles"]');
                    if (btn) btn.click();
                });
            }
        }
    }

    // ============================================================
    // 3. Tick
    // ============================================================
    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at && data.updated_at !== lastRenderedUpdatedAt) {
                lastRenderedUpdatedAt = data.updated_at;
                // небольшая задержка, чтобы app.js успел отработать safeRender
                setTimeout(renderLast24h, 300);
            }
        } catch (e) {}
        setTimeout(tick, 1500);
    }

    // ============================================================
    // 4. Boot
    // ============================================================
    function boot() {
        // Первичный рендер с задержкой
        setTimeout(renderLast24h, 800);
        setTimeout(renderLast24h, 2000);
        setTimeout(renderLast24h, 4000);
        tick();
        console.log('[EventLog24h] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.EventLog24h = { refresh: renderLast24h };
})();
