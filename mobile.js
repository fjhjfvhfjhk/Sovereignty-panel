/* ============================================================
   SOVEREIGNTY PANEL · MOBILE.JS v1.0
   ============================================================
   Мобильные улучшения панели.

   Что делает:
     1. Bottom navigation bar — фиксированная панель снизу.
     2. Топ стран → карточки (mobile-only контейнер).
     3. Свайпы между вкладками (влево/вправо).
     4. Pull-to-refresh — потяни вниз для обновления.
     5. Haptic feedback — вибрация на тапах.
     6. Pinch-zoom для карты (touch).
     7. Компактная шапка.

   Подключать ПОСЛЕ panel-detail.js:
     <script src="panel-detail.js"></script>
     <script src="mobile.js"></script>
   ============================================================ */
(function () {
    'use strict';

    var TABS = [
        { key: 'overview', icon: '🏠', label: 'Обзор' },
        { key: 'map',      icon: '🗺️', label: 'Карта' },
        { key: 'players',  icon: '👥', label: 'Игроки' },
        { key: 'guide',    icon: '📖', label: 'Гайд' },
        { key: 'commands', icon: '⌨️', label: 'Команды' },
        { key: 'bonus',    icon: '🎁', label: 'Бонусы' }
    ];

    var isMobile = function () {
        return window.matchMedia('(max-width: 768px)').matches;
    };

    var hapticsEnabled = true;
    try {
        hapticsEnabled = localStorage.getItem('panel_haptics') !== '0';
    } catch (e) {}

    // ============================================================
    // 1. HAPTIC FEEDBACK
    // ============================================================
    function installHaptics() {
        document.addEventListener('click', function (e) {
            if (!isMobile()) return;
            if (!hapticsEnabled) return;
            var el = e.target.closest('button, .bn-btn, .tab, .nav-btn, .map-btn, .btn, .player-card, .ccm-card, .legend-item, .player-modal-btn');
            if (!el) return;
            try {
                if (navigator.vibrate) navigator.vibrate(6);
            } catch (err) {}
        }, { passive: true });
    }

    // ============================================================
    // 2. BOTTOM NAVIGATION BAR
    // ============================================================
    function installBottomNav() {
        if (!isMobile()) return;
        if (document.getElementById('bottom-nav')) return;

        var nav = document.createElement('nav');
        nav.id = 'bottom-nav';
        nav.className = 'bottom-nav';
        nav.setAttribute('aria-label', 'Основная навигация');

        var html = '';
        for (var i = 0; i < TABS.length; i++) {
            var t = TABS[i];
            var active = i === 0 ? ' active' : '';
            html += '<button class="bn-btn' + active + '" data-tab="' + t.key + '" type="button" ' +
                    'aria-label="' + t.label + '">' +
                '<span class="bn-icon">' + t.icon + '</span>' +
                '<span class="bn-label">' + t.label + '</span>' +
            '</button>';
        }
        nav.innerHTML = html;
        document.body.appendChild(nav);

        nav.addEventListener('click', function (e) {
            var btn = e.target.closest('.bn-btn');
            if (!btn) return;
            var tab = btn.dataset.tab;
            switchTab(tab);
        });

        // Синхронизируем с основным nav
        syncBottomNavWithTabs();
    }

    function switchTab(tabKey) {
        // Через верхний navbar (там уже вся логика)
        var topBtn = document.querySelector('.main-nav .nav-btn[data-tab="' + tabKey + '"]');
        if (topBtn) topBtn.click();
        syncBottomNavWithTabs();
        // Скролл к началу
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }

    function syncBottomNavWithTabs() {
        var nav = document.getElementById('bottom-nav');
        if (!nav) return;
        var activeTop = document.querySelector('.main-nav .nav-btn.active');
        var activeKey = activeTop ? activeTop.dataset.tab : 'overview';
        var btns = nav.querySelectorAll('.bn-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', btns[i].dataset.tab === activeKey);
        }
    }

    // Слушаем клики по верхнему nav (например, из других скриптов)
    function watchTopNav() {
        var topNav = document.querySelector('.main-nav');
        if (!topNav) return;
        var obs = new MutationObserver(syncBottomNavWithTabs);
        topNav.querySelectorAll('.nav-btn').forEach(function (b) {
            obs.observe(b, { attributes: true, attributeFilter: ['class'] });
        });
    }

    // ============================================================
    // 3. СВАЙПЫ МЕЖДУ ВКЛАДКАМИ
    // ============================================================
    function installSwipes() {
        var startX = 0;
        var startY = 0;
        var startTime = 0;
        var tracking = false;

        document.addEventListener('touchstart', function (e) {
            if (!isMobile()) return;
            // Не свайпаем внутри карты, слайдера, скролл-зон
            if (e.target.closest('#map-viewport, input, textarea, select')) return;
            if (e.touches.length !== 1) return;
            var t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startTime = Date.now();
            tracking = true;
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
            if (!tracking) return;
            tracking = false;
            if (!isMobile()) return;
            var t = e.changedTouches[0];
            var dx = t.clientX - startX;
            var dy = t.clientY - startY;
            var dt = Date.now() - startTime;

            // Свайп: быстрый (≤600ms), горизонтальный (>60px), не слишком вертикальный
            if (dt > 600) return;
            if (Math.abs(dx) < 60) return;
            if (Math.abs(dy) > Math.abs(dx) * 0.7) return;

            var active = document.querySelector('.main-nav .nav-btn.active');
            if (!active) return;
            var currentIdx = -1;
            for (var i = 0; i < TABS.length; i++) {
                if (TABS[i].key === active.dataset.tab) { currentIdx = i; break; }
            }
            if (currentIdx === -1) return;

            var newIdx = dx > 0 ? currentIdx - 1 : currentIdx + 1;
            if (newIdx < 0 || newIdx >= TABS.length) return;
            switchTab(TABS[newIdx].key);

            try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) {}
        }, { passive: true });
    }

    // ============================================================
    // 4. PULL-TO-REFRESH
    // ============================================================
    function installPullToRefresh() {
        if (!isMobile()) return;

        var indicator = document.createElement('div');
        indicator.className = 'ptr-indicator';
        indicator.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 12a9 9 0 1 1-3-6.7"/>' +
                '<path d="M21 3v6h-6"/>' +
            '</svg>';
        document.body.appendChild(indicator);

        var startY = 0;
        var currentY = 0;
        var pulling = false;
        var triggered = false;
        var THRESHOLD = 90;

        document.addEventListener('touchstart', function (e) {
            if (!isMobile()) return;
            if (window.scrollY > 4) return;
            if (e.target.closest('#map-viewport, input, textarea, select')) return;
            if (e.touches.length !== 1) return;
            startY = e.touches[0].clientY;
            pulling = true;
            triggered = false;
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
            if (!pulling) return;
            currentY = e.touches[0].clientY;
            var dy = currentY - startY;
            if (dy < 10) return;
            if (dy > THRESHOLD + 30) dy = THRESHOLD + 30;
            var ratio = Math.min(dy / THRESHOLD, 1);
            indicator.classList.add('visible');
            indicator.style.transform =
                'translate(-50%, ' + (16 + dy * 0.4) + 'px) scale(' + (0.8 + ratio * 0.2) + ')';
        }, { passive: true });

        document.addEventListener('touchend', function () {
            if (!pulling) return;
            pulling = false;
            var dy = currentY - startY;

            if (dy >= THRESHOLD && !triggered) {
                triggered = true;
                indicator.classList.add('spinning');
                indicator.style.transform = 'translate(-50%, 16px) scale(1)';
                try { if (navigator.vibrate) navigator.vibrate([10, 20, 10]); } catch (e) {}

                // Триггерим перезагрузку данных
                try {
                    if (typeof window.loadData === 'function') window.loadData();
                    if (typeof window.loadMap === 'function') window.loadMap();
                } catch (e) {}

                setTimeout(function () {
                    indicator.classList.remove('spinning');
                    indicator.classList.remove('visible');
                    indicator.style.transform = '';
                }, 1200);
            } else {
                indicator.classList.remove('visible');
                indicator.style.transform = '';
            }
            startY = 0;
            currentY = 0;
        }, { passive: true });
    }

    // ============================================================
    // 5. КАРТОЧКИ СТРАН (mobile only)
    // ============================================================

    /**
     * Хук в renderCountries: после дефолтного рендера (в таблицу)
     * дополнительно строим мобильные карточки в отдельный контейнер.
     */
    function installCountryCardsHook() {
        // Создаём контейнер под карточки
        var tbody = document.getElementById('countries-body');
        if (!tbody) return;
        var wrap = tbody.closest('.table-wrap');
        if (!wrap) return;
        if (document.getElementById('country-cards-mobile')) return;

        var container = document.createElement('div');
        container.id = 'country-cards-mobile';
        container.className = 'country-cards-mobile';
        wrap.parentNode.insertBefore(container, wrap.nextSibling);

        // Wrapping renderCountries
        if (typeof window.renderCountries === 'function' && !window.__mobileCardsHooked) {
            window.__mobileCardsHooked = true;
            var prevRender = window.renderCountries;
            window.renderCountries = function () {
                var result = prevRender.apply(this, arguments);
                renderCountryCards();
                return result;
            };
        }
    }

    function renderCountryCards() {
        var container = document.getElementById('country-cards-mobile');
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
            container.innerHTML = '<div class="empty-hint">Пока нет стран.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < countries.length; i++) {
            html += buildCountryCard(countries[i], i);
        }
        container.innerHTML = html;

        // Обновляем аватарки, если PanelAvatars доступен
        if (window.PanelAvatars && window.PanelAvatars.refresh) {
            setTimeout(window.PanelAvatars.refresh, 100);
        }
    }

    function buildCountryCard(c, idx) {
        var rank = idx + 1;
        var rankCls = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        var color = c.color || '#6366f1';

        var owner = c.owner || '?';
        var ownerName = String(owner);

        // Аватарка
        var avatarSrc;
        if (window.PanelAvatars && window.PanelAvatars.get) {
            avatarSrc = window.PanelAvatars.get(ownerName, 32);
        } else {
            // Простой fallback
            var letter = ownerName.charAt(0).toUpperCase();
            avatarSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
                    '<rect width="32" height="32" rx="4" fill="#6366f1"/>' +
                    '<text x="16" y="22" text-anchor="middle" font-family="Georgia" font-size="17" font-weight="800" fill="white">' +
                    letter +
                    '</text></svg>');
        }

        var claims = (c.claims || 0);
        var maxClaims = c.max_claims != null ? c.max_claims : '?';
        var delta = c.claims_delta_7d || 0;
        var deltaCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        var deltaStr = delta > 0 ? '▲ +' + delta
                     : delta < 0 ? '▼ −' + Math.abs(delta)
                     : '0';

        var capIcon = c.capital ? ' 🏛️' : '';

        return '<article class="ccm-card" style="--row-color:' + escapeAttr(color) + ';" ' +
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
                    '<span class="ccm-stat-label">Рост 7д</span>' +
                    '<span class="ccm-stat-value delta ' + deltaCls + '">' + deltaStr + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Казна</span>' +
                    '<span class="ccm-stat-value money">' + formatMoney(c.bank || 0) + '</span>' +
                '</div>' +
                '<div class="ccm-stat">' +
                    '<span class="ccm-stat-label">Энергия</span>' +
                    '<span class="ccm-stat-value energy">' + (c.energy || 0).toFixed(1) + '</span>' +
                '</div>' +
            '</div>' +
        '</article>';
    }

    function formatMoney(a) {
        if (a == null) return '0';
        var abs = Math.abs(a);
        if (abs >= 1000000) return (a / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (a / 1000).toFixed(1) + 'k';
        return Math.round(a).toString();
    }

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
    // 6. PINCH-ZOOM ДЛЯ КАРТЫ (touch)
    // ============================================================
    function installMapPinchZoom() {
        if (!isMobile()) return;
        var vp = document.getElementById('map-viewport');
        if (!vp) return;
        if (vp.dataset.pinchReady === '1') return;
        vp.dataset.pinchReady = '1';

        var pinchStartDist = 0;
        var pinchStartZoom = 1;
        var pinchMidX = 0;
        var pinchMidY = 0;

        vp.addEventListener('touchstart', function (e) {
            if (e.touches.length === 2) {
                var t1 = e.touches[0];
                var t2 = e.touches[1];
                var dx = t2.clientX - t1.clientX;
                var dy = t2.clientY - t1.clientY;
                pinchStartDist = Math.sqrt(dx * dx + dy * dy);
                pinchStartZoom = window.mapZoom || 1;
                pinchMidX = (t1.clientX + t2.clientX) / 2;
                pinchMidY = (t1.clientY + t2.clientY) / 2;
            }
        }, { passive: true });

        vp.addEventListener('touchmove', function (e) {
            if (e.touches.length === 2 && pinchStartDist > 0) {
                e.preventDefault();
                var t1 = e.touches[0];
                var t2 = e.touches[1];
                var dx = t2.clientX - t1.clientX;
                var dy = t2.clientY - t1.clientY;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var scale = dist / pinchStartDist;
                var newZoom = Math.max(0.1, Math.min(12, pinchStartZoom * scale));

                var rect = vp.getBoundingClientRect();
                var cx = pinchMidX - rect.left;
                var cy = pinchMidY - rect.top;

                // Сохраняем точку под пальцами
                var oldZoom = window.mapZoom || 1;
                var ix = (cx - (window.mapOffsetX || 0)) / oldZoom;
                var iy = (cy - (window.mapOffsetY || 0)) / oldZoom;

                window.mapZoom = newZoom;
                window.mapOffsetX = cx - ix * newZoom;
                window.mapOffsetY = cy - iy * newZoom;

                if (typeof window.applyMapTransform === 'function') {
                    window.applyMapTransform();
                }
            }
        }, { passive: false });

        vp.addEventListener('touchend', function () {
            pinchStartDist = 0;
        }, { passive: true });
    }

    // ============================================================
    // 7. TICK — поддержка мобильных карточек при обновлении
    // ============================================================
    var lastUpdatedAt = 0;

    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(renderCountryCards, 400);
            }
            // Синхронизация bottom-nav каждый тик
            syncBottomNavWithTabs();
        } catch (e) {}
        setTimeout(tick, 1200);
    }

    // ============================================================
    // 8. BOOT
    // ============================================================
    function boot() {
        installHaptics();
        installBottomNav();
        watchTopNav();
        installSwipes();
        installPullToRefresh();
        installCountryCardsHook();
        installMapPinchZoom();

        // Первый прогон карточек
        setTimeout(renderCountryCards, 700);
        tick();

        // Пересборка при resize
        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (isMobile()) {
                    installBottomNav();
                } else {
                    var nav = document.getElementById('bottom-nav');
                    if (nav) nav.remove();
                }
            }, 250);
        });

        console.log('[Mobile] v1.0 ready (' + (isMobile() ? 'mobile' : 'desktop') + ')');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelMobile = {
        switchTab: switchTab,
        refresh: function () {
            renderCountryCards();
            syncBottomNavWithTabs();
        }
    };
})();
