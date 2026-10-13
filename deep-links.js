/* ============================================================
   SOVEREIGNTY PANEL · DEEP-LINKS.JS v1.0
   ============================================================
   URL-состояние и deep-links:
     ?tab=map         — открыть вкладку
     ?player=Ник      — открыть модалку игрока
     ?country=Ник     — открыть паспорт страны (дублирует
                        логику country-passport.js, но работает
                        на любом состоянии URL)
     ?compare=A,B     — сравнение двух стран (обрабатывается
                        country-compare.js)

   Плюс:
     - При переключении вкладок URL обновляется (history.replaceState),
       чтобы пользователь мог скопировать/поделиться.
     - Кнопка «назад» работает через popstate.

   ПОДКЛЮЧЕНИЕ: последним <script>.
   ============================================================ */
(function () {
    'use strict';

    var lastTab = null;

    function getParam(key) {
        try {
            return new URLSearchParams(location.search).get(key);
        } catch (e) { return null; }
    }

    function setParam(key, value) {
        try {
            var url = new URL(location.href);
            if (value == null) url.searchParams.delete(key);
            else url.searchParams.set(key, value);
            history.replaceState(history.state || {}, '', url.toString());
        } catch (e) {}
    }

    // ============================================================
    // 1. Переключение вкладки + URL
    // ============================================================
    function installTabSync() {
        var topNav = document.querySelector('.main-nav');
        if (!topNav) return;

        topNav.addEventListener('click', function (e) {
            var btn = e.target.closest('.nav-btn');
            if (!btn) return;
            var tab = btn.dataset.tab;
            if (!tab) return;
            lastTab = tab;
            // Небольшая задержка, чтобы app.js переключил контент
            setTimeout(function () {
                setParam('tab', tab === 'overview' ? null : tab);
            }, 50);
        });

        // Восстановление вкладки из URL при загрузке
        var urlTab = getParam('tab');
        if (urlTab && urlTab !== 'overview') {
            var restore = function () {
                var btn = document.querySelector('.main-nav .nav-btn[data-tab="' + urlTab + '"]');
                if (btn) {
                    btn.click();
                }
            };
            // Ждём пока загрузится основная логика app.js
            setTimeout(restore, 500);
            setTimeout(restore, 1500);
        }
    }

    // ============================================================
    // 2. ?player=Ник
    // ============================================================
    function installPlayerDeepLink() {
        var name = getParam('player');
        if (!name) return;

        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (typeof window.openPlayer === 'function'
                    && window.currentData && window.currentData.players
                    && window.currentData.players.length > 0) {
                clearInterval(iv);
                // Проверяем, что игрок есть
                var exists = window.currentData.players.some(function (p) {
                    return p.name === name;
                });
                if (exists) {
                    window.openPlayer(name);
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Игрок не найден: ' + name);
                }
            } else if (tries > 30) {
                clearInterval(iv);
            }
        }, 300);
    }

    // ============================================================
    // 3. ?country=Ник — резерв (у passport своя логика, но если
    // он не сработает, мы повторим)
    // ============================================================
    function installCountryDeepLinkReserve() {
        var name = getParam('country');
        if (!name) return;

        // country-passport.js уже умеет это, но на всякий случай
        // — вызываем повторно через 3 сек, если модалка не открылась
        setTimeout(function () {
            var m = document.getElementById('country-modal');
            if (m && m.classList.contains('show')) return;
            if (typeof window.openCountryPassport === 'function') {
                window.openCountryPassport(name);
            }
        }, 3000);
    }

    // ============================================================
    // 4. Копирование текущего URL на Ctrl+Shift+L (лайфхак)
    // ============================================================
    function installQuickCopy() {
        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                var url = location.href;
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(url).then(function () {
                        if (typeof window.showToast === 'function') {
                            window.showToast('✓ Ссылка скопирована');
                        }
                    });
                }
            }
        });
    }

    // ============================================================
    // 5. Boot
    // ============================================================
    function boot() {
        installTabSync();
        installPlayerDeepLink();
        installCountryDeepLinkReserve();
        installQuickCopy();
        console.log('[DeepLinks] v1.0 ready, params=' +
            ' tab=' + (getParam('tab') || '-') +
            ' player=' + (getParam('player') || '-') +
            ' country=' + (getParam('country') || '-'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.DeepLinks = {
        setTab: function (tab) { setParam('tab', tab); },
        setPlayer: function (name) { setParam('player', name); },
        setCountry: function (name) { setParam('country', name); }
    };
})();
