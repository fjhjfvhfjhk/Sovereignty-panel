/* ============================================================
   SOVEREIGNTY PANEL · MOBILE.JS v1.1
   ============================================================
   Мобильные улучшения. ИЗМЕНЕНИЯ v1.1:

     - УБРАНЫ свайпы между вкладками (мешали скроллу).
     - Pull-to-refresh не работает при фокусе на input.
     - Память скролла per-tab.
     - Android back → закрыть модалку или вернуть на Обзор.
     - Long-press на карточке игрока = копирование ника.
     - Настройки в localStorage: haptics, ptr.

   Подключать ПОСЛЕ panel-detail.js.
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

    var STORAGE_SCROLL = 'panel_scroll_memory';
    var STORAGE_HAPTICS = 'panel_haptics';
    var STORAGE_PTR = 'panel_pull_refresh';

    var isMobile = function () {
        return window.matchMedia('(max-width: 768px)').matches;
    };

    // ============================================================
    // 1. HAPTIC FEEDBACK
    // ============================================================
    function hapticsOn() {
        try { return localStorage.getItem(STORAGE_HAPTICS) !== '0'; }
        catch (e) { return true; }
    }

    function installHaptics() {
        document.addEventListener('click', function (e) {
            if (!isMobile() || !hapticsOn()) return;
            var el = e.target.closest(
                'button, .bn-btn, .tab, .nav-btn, .map-btn, .btn,' +
                '.player-card, .ccm-card, .legend-item, .player-modal-btn,' +
                '.modal-close, .map-layers-close, .map-layers-restore');
            if (!el) return;
            try { if (navigator.vibrate) navigator.vibrate(6); } catch (err) {}
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
            switchTab(btn.dataset.tab);
        });

        syncBottomNavWithTabs();
    }

    /**
     * v1.1: при переключении вкладки сохраняем scroll текущей,
     * восстанавливаем scroll новой. Так пользователь возвращается
     * туда, где был.
     */
    function switchTab(tabKey) {
        // Сохраняем scroll текущей вкладки
        saveCurrentScroll();

        var topBtn = document.querySelector('.main-nav .nav-btn[data-tab="' + tabKey + '"]');
        if (topBtn) topBtn.click();

        syncBottomNavWithTabs();

        // Восстанавливаем scroll новой
        setTimeout(function () {
            restoreScrollForTab(tabKey);
        }, 50);
    }

    function saveCurrentScroll() {
        try {
            var active = document.querySelector('.main-nav .nav-btn.active');
            if (!active) return;
            var key = active.dataset.tab;
            var mem = JSON.parse(sessionStorage.getItem(STORAGE_SCROLL) || '{}');
            mem[key] = window.scrollY || 0;
            sessionStorage.setItem(STORAGE_SCROLL, JSON.stringify(mem));
        } catch (e) {}
    }

    function restoreScrollForTab(tabKey) {
        try {
            var mem = JSON.parse(sessionStorage.getItem(STORAGE_SCROLL) || '{}');
            var y = mem[tabKey] || 0;
            window.scrollTo({ top: y, behavior: 'instant' in window ? 'instant' : 'auto' });
        } catch (e) {
            window.scrollTo(0, 0);
        }
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

    function watchTopNav() {
        var topNav = document.querySelector('.main-nav');
        if (!topNav) return;
        var obs = new MutationObserver(syncBottomNavWithTabs);
        topNav.querySelectorAll('.nav-btn').forEach(function (b) {
            obs.observe(b, { attributes: true, attributeFilter: ['class'] });
        });
    }

    // ============================================================
    // 3. PULL-TO-REFRESH
    // ============================================================
    function ptrOn() {
        try { return localStorage.getItem(STORAGE_PTR) !== '0'; }
        catch (e) { return true; }
    }

    function installPullToRefresh() {
        if (!isMobile()) return;

        var indicator = document.createElement('div');
        indicator.className = 'ptr-indicator';
        indicator.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
                 'stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 12a9 9 0 1 1-3-6.7"/>' +
                '<path d="M21 3v6h-6"/>' +
            '</svg>';
        document.body.appendChild(indicator);

        var startY = 0;
        var currentY = 0;
        var pulling = false;
        var triggered = false;
        var THRESHOLD = 90;

        function isInputFocused() {
            var el = document.activeElement;
            if (!el) return false;
            var tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
        }

        document.addEventListener('touchstart', function (e) {
            if (!isMobile() || !ptrOn()) return;
            if (window.scrollY > 4) return;
            if (isInputFocused()) return;
            if (e.target.closest('#map-viewport, input, textarea, select')) return;
            if (e.touches.length !== 1) return;
            startY = e.touches[0].clientY;
            pulling = true;
            triggered = false;
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
            if (!pulling) return;
            // v1.1: если пользователь сфокусировался на input в процессе
            if (isInputFocused()) { pulling = false; indicator.classList.remove('visible'); return; }
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
    // 4. КАРТОЧКИ СТРАН (mobile only)
    // ============================================================
    function installCountryCardsHook() {
        var tbody = document.getElementById('countries-body');
        if (!tbody) return;
        var wrap = tbody.closest('.table-wrap');
        if (!wrap) return;
        if (document.getElementById('country-cards-mobile')) return;

        var container = document.createElement('div');
        container.id = 'country-cards-mobile';
        container.className = 'country-cards-mobile';
        wrap.parentNode.insertBefore(container, wrap.nextSibling);

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

        var avatarSrc;
        if (window.PanelAvatars && window.PanelAvatars.get) {
            avatarSrc = window.PanelAvatars.get(ownerName, 32);
        } else {
            var letter = ownerName.charAt(0).toUpperCase();
            avatarSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
                    '<rect width="32" height="32" rx="4" fill="#6366f1"/>' +
                    '<text x="16" y="22" text-anchor="middle" font-family="Georgia" ' +
                           'font-size="17" font-weight="800" fill="white">' +
                    letter + '</text></svg>');
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
    // 5. PINCH-ZOOM ДЛЯ КАРТЫ
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
    // 6. ANDROID BACK-BUTTON
    // ============================================================
    function installAndroidBack() {
        if (!isMobile()) return;

        // Ставим фейковый стейт при загрузке, чтобы поймать back
        try {
            history.replaceState({ panel: 'home' }, '');
            history.pushState({ panel: 'nav' }, '');
        } catch (e) {}

        window.addEventListener('popstate', function (e) {
            // 1. Открыта модалка — закрываем
            var modal = document.querySelector('.modal.show');
            if (modal) {
                if (typeof window.closePlayerModal === 'function') window.closePlayerModal();
                // Восстанавливаем стек
                try { history.pushState({ panel: 'nav' }, ''); } catch (err) {}
                return;
            }

            // 2. Не на Обзоре — переходим на Обзор
            var active = document.querySelector('.main-nav .nav-btn.active');
            if (active && active.dataset.tab !== 'overview') {
                switchTab('overview');
                try { history.pushState({ panel: 'nav' }, ''); } catch (err) {}
                return;
            }

            // 3. На Обзоре — позволяем выйти
            try { history.back(); } catch (err) {}
        });
    }

    // ============================================================
    // 7. LONG-PRESS НА КАРТОЧКЕ ИГРОКА
    // ============================================================
    function installLongPressCopy() {
        if (!isMobile()) return;

        var pressTimer = null;
        var pressedCard = null;
        var LONG_PRESS_MS = 500;

        function startPress(e) {
            var card = e.target.closest('.player-card');
            if (!card) return;
            pressedCard = card;
            pressTimer = setTimeout(function () {
                var nameEl = card.querySelector('.player-card-name');
                if (!nameEl) return;
                var name = nameEl.textContent.trim();
                if (!name) return;
                card.classList.add('pressing');
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(name);
                    } else {
                        var ta = document.createElement('textarea');
                        ta.value = name;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    }
                    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
                    if (typeof window.showToast === 'function') {
                        window.showToast('✓ Скопировано: ' + name);
                    }
                } catch (err) {}
                setTimeout(function () {
                    card.classList.remove('pressing');
                }, 700);
                pressTimer = null;
                pressedCard = null;
            }, LONG_PRESS_MS);
        }

        function cancelPress() {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            if (pressedCard) {
                pressedCard.classList.remove('pressing');
                pressedCard = null;
            }
        }

        document.addEventListener('touchstart', startPress, { passive: true });
        document.addEventListener('touchend', cancelPress, { passive: true });
        document.addEventListener('touchcancel', cancelPress, { passive: true });
        document.addEventListener('touchmove', cancelPress, { passive: true });
    }

    // ============================================================
    // 8. SCROLL MEMORY — сохраняем при уходе со страницы
    // ============================================================
    function installScrollMemory() {
        window.addEventListener('beforeunload', saveCurrentScroll);
        // И при visibility-change (мобилки часто сворачивают таб)
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) saveCurrentScroll();
        });
    }

    // ============================================================
    // 9. TICK
    // ============================================================
    var lastUpdatedAt = 0;

    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(renderCountryCards, 400);
            }
            syncBottomNavWithTabs();
        } catch (e) {}
        setTimeout(tick, 1200);
    }

    // ============================================================
    // 10. BOOT
    // ============================================================
    function boot() {
        installHaptics();
        installBottomNav();
        watchTopNav();
        installPullToRefresh();
        installCountryCardsHook();
        installMapPinchZoom();
        installAndroidBack();
        installLongPressCopy();
        installScrollMemory();

        setTimeout(renderCountryCards, 700);
        tick();

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

        console.log('[Mobile] v1.1 ready (' + (isMobile() ? 'mobile' : 'desktop') + ')');
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
        },
        setHaptics: function (on) {
            try { localStorage.setItem(STORAGE_HAPTICS, on ? '1' : '0'); } catch (e) {}
        },
        setPullToRefresh: function (on) {
            try { localStorage.setItem(STORAGE_PTR, on ? '1' : '0'); } catch (e) {}
        }
    };
})();
