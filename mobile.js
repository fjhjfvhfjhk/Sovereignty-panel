/* ============================================================
   SOVEREIGNTY PANEL · MOBILE.JS v1.4
   ============================================================
   v1.4 (14.10.2026):
     - ГАРАНТИРОВАННАЯ SVG-замена: если PanelIcons ещё не готов,
       строим nav без иконок, а через MutationObserver/setTimeout
       пересобираем, как только PanelIcons появляется.
     - Убран "·" fallback — вместо этого пусто, потом допишется SVG.

   v1.3: SVG-иконки вместо эмодзи в TABS.
   v1.2: добавлена вкладка Хроники.
   ============================================================ */
(function () {
    'use strict';

    var ICON_SIZE = 22;

    var TABS = [
        { key: 'overview',   icon: 'home',     label: 'Обзор' },
        { key: 'map',        icon: 'map',      label: 'Карта' },
        { key: 'players',    icon: 'users',    label: 'Игроки' },
        { key: 'chronicles', icon: 'scroll',   label: 'Хроники' },
        { key: 'guide',      icon: 'book',     label: 'Гайд' },
        { key: 'commands',   icon: 'keyboard', label: 'Команды' },
        { key: 'bonus',      icon: 'gift',     label: 'Бонусы' }
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
    function renderIconInto(wrap, iconName) {
        wrap.innerHTML = '';
        if (!window.PanelIcons || !window.PanelIcons.element) return false;
        var svg = window.PanelIcons.element(iconName, ICON_SIZE);
        if (!svg) return false;
        wrap.appendChild(svg);
        return true;
    }

    function buildBottomNav() {
        var nav = document.createElement('nav');
        nav.id = 'bottom-nav';
        nav.className = 'bottom-nav';
        nav.setAttribute('aria-label', 'Основная навигация');

        for (var i = 0; i < TABS.length; i++) {
            var t = TABS[i];
            var btn = document.createElement('button');
            btn.className = 'bn-btn' + (i === 0 ? ' active' : '');
            btn.dataset.tab = t.key;
            btn.type = 'button';
            btn.setAttribute('aria-label', t.label);

            var iconWrap = document.createElement('span');
            iconWrap.className = 'bn-icon';
            renderIconInto(iconWrap, t.icon);
            btn.appendChild(iconWrap);

            var label = document.createElement('span');
            label.className = 'bn-label';
            label.textContent = t.label;
            btn.appendChild(label);

            nav.appendChild(btn);
        }

        return nav;
    }

    function installBottomNav() {
        if (!isMobile()) {
            var existing = document.getElementById('bottom-nav');
            if (existing) existing.remove();
            return;
        }
        if (document.getElementById('bottom-nav')) return;

        var nav = buildBottomNav();
        document.body.appendChild(nav);

        nav.addEventListener('click', function (e) {
            var btn = e.target.closest('.bn-btn');
            if (!btn) return;
            switchTab(btn.dataset.tab);
        });

        syncBottomNavWithTabs();

        /* Если PanelIcons ещё не загрузился — дорисовываем иконки */
        if (!window.PanelIcons) {
            var tries = 0;
            var iv = setInterval(function () {
                tries++;
                if (window.PanelIcons || tries > 40) clearInterval(iv);
                if (window.PanelIcons) rebuildNavIcons();
            }, 50);
        }
    }

    function rebuildNavIcons() {
        var nav = document.getElementById('bottom-nav');
        if (!nav) return;
        if (!window.PanelIcons || !window.PanelIcons.element) return;
        var btns = nav.querySelectorAll('.bn-btn');
        for (var i = 0; i < btns.length; i++) {
            var btn = btns[i];
            var key = btn.dataset.tab;
            var tab = null;
            for (var j = 0; j < TABS.length; j++) {
                if (TABS[j].key === key) { tab = TABS[j]; break; }
            }
            if (!tab) continue;
            var wrap = btn.querySelector('.bn-icon');
            if (!wrap) continue;
            if (wrap.querySelector('svg')) continue;
            renderIconInto(wrap, tab.icon);
        }
    }

    function switchTab(tabKey) {
        saveCurrentScroll();

        var topBtn = document.querySelector('.main-nav .nav-btn[data-tab="' + tabKey + '"]');
        if (topBtn) topBtn.click();

        syncBottomNavWithTabs();

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
    // 4. КАРТОЧКИ СТРАН (hook)
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

        try {
            history.replaceState({ panel: 'home' }, '');
            history.pushState({ panel: 'nav' }, '');
        } catch (e) {}

        window.addEventListener('popstate', function (e) {
            var modal = document.querySelector('.modal.show');
            if (modal) {
                if (typeof window.closePlayerModal === 'function') window.closePlayerModal();
                if (typeof window.closeCountryPassport === 'function') window.closeCountryPassport();
                try { history.pushState({ panel: 'nav' }, ''); } catch (err) {}
                return;
            }

            var active = document.querySelector('.main-nav .nav-btn.active');
            if (active && active.dataset.tab !== 'overview') {
                switchTab('overview');
                try { history.pushState({ panel: 'nav' }, ''); } catch (err) {}
                return;
            }

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
                        window.showToast('Скопировано: ' + name);
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
    // 8. SCROLL MEMORY
    // ============================================================
    function installScrollMemory() {
        window.addEventListener('beforeunload', saveCurrentScroll);
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
                setTimeout(function () {
                    if (typeof window.CountryCards !== 'undefined' && window.CountryCards.refresh) {
                        window.CountryCards.refresh();
                    }
                }, 400);
            }
            syncBottomNavWithTabs();
            /* Периодическая пересборка иконок — на случай, если
               PanelIcons подгрузился позже. */
            rebuildNavIcons();
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

        /* Несколько попыток пересборки иконок — на случай позднего PanelIcons */
        setTimeout(rebuildNavIcons, 200);
        setTimeout(rebuildNavIcons, 600);
        setTimeout(rebuildNavIcons, 1500);

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                installBottomNav();
                rebuildNavIcons();
            }, 250);
        });

        tick();
        console.log('[Mobile] v1.4 ready (SVG nav icons, robust)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelMobile = {
        switchTab: switchTab,
        refresh: function () {
            if (typeof window.CountryCards !== 'undefined' && window.CountryCards.refresh) {
                window.CountryCards.refresh();
            }
            syncBottomNavWithTabs();
            rebuildNavIcons();
        },
        setHaptics: function (on) {
            try { localStorage.setItem(STORAGE_HAPTICS, on ? '1' : '0'); } catch (e) {}
        },
        setPullToRefresh: function (on) {
            try { localStorage.setItem(STORAGE_PTR, on ? '1' : '0'); } catch (e) {}
        }
    };
})();
