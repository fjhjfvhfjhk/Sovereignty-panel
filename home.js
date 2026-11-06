/* ============================================================
   SOVEREIGNTY PANEL · HOME.JS v1.2
   ============================================================
   v1.2 (06.11.2026):
     - ФИКС кнопки «← На главную»: добавлены ПРЯМЫЕ обработчики
       на `.about-back-link` через addEventListener, а не только
       делегированный `[data-home-tab]`. На случай, если какой-то
       другой обработчик перехватывает событие раньше.
     - Убран `[data-copy-ip]` — теперь копирование IP везде
       через inline-код `<code data-copy="...">`, который
       обрабатывается `initCommandCopy()` из app.js (тот же
       механизм что в гайде). Показывает тост «Скопировано: ...»
       на 1.6 сек.
     - Обработчики навигации получили `e.preventDefault()` для
       надёжности.

   v1.1: главная — IP-копирование и переходы по 6 кнопкам.
   v1.0: главная — IP-копирование через `data-copy-ip`.
   ============================================================ */
(function () {
    'use strict';

    var SERVER_IP = 'sovereignty.millida.host';

    // ============================================================
    // 1. Копирование IP через data-copy-ip (на главной странице
    //    осталась кнопка с этим атрибутом — используем его как
    //    fallback, если app.js/initCommandCopy недоступен)
    // ============================================================
    function copyWithFeedback(btn) {
        var ip = btn.getAttribute('data-copy-ip') || SERVER_IP;
        if (!ip) return;

        var originalText = btn.dataset.originalText || btn.textContent;
        btn.dataset.originalText = originalText;

        function showSuccess() {
            btn.textContent = '✓ Скопировано';
            btn.classList.add('copied');
            if (typeof window.showToast === 'function') {
                window.showToast('IP скопирован: ' + ip);
            }
            setTimeout(function () {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 1600);
        }

        function showFail() {
            if (typeof window.showToast === 'function') {
                window.showToast('Не удалось скопировать. Выделите IP вручную.');
            }
        }

        if (typeof window.copyToClipboard === 'function') {
            window.copyToClipboard(ip)
                .then(function (ok) { if (ok) showSuccess(); else showFail(); })
                .catch(showFail);
            return;
        }

        // Fallback без clipboard API
        try {
            var ta = document.createElement('textarea');
            ta.value = ip;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            if (ok) showSuccess(); else showFail();
        } catch (e) {
            showFail();
        }
    }

    function installIpCopy() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-copy-ip]');
            if (!btn) return;
            e.preventDefault();
            copyWithFeedback(btn);
        });
    }

    // ============================================================
    // 2. НАВИГАЦИЯ через [data-home-tab] (главная, кнопки, CTA)
    // ============================================================
    function switchToTab(target) {
        if (!target) return;
        var navBtn = document.querySelector(
            '.main-nav .nav-btn[data-tab="' + target + '"]'
        );
        if (navBtn) {
            navBtn.click();
        } else {
            // Fallback: ручное переключение
            document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) {
                b.classList.toggle('active', b.dataset.tab === target);
            });
            document.querySelectorAll('.tab-content').forEach(function (c) {
                c.classList.toggle('active', c.id === 'tab-' + target);
            });
            var tab = document.getElementById('tab-' + target);
            if (tab) tab.classList.add('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function installHomeButtons() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-home-tab]');
            if (!btn) return;
            // Пропускаем, если на кнопке уже висит прямой обработчик
            // (см. installBackLinks ниже)
            if (btn.dataset.directBackHandler === '1') return;
            e.preventDefault();
            switchToTab(btn.getAttribute('data-home-tab'));
        });
    }

    // ============================================================
    // 3. ПРЯМЫЕ обработчики на «← На главную» — v1.2
    // ============================================================
    function installBackLinks() {
        var links = document.querySelectorAll('.about-back-link');
        for (var i = 0; i < links.length; i++) {
            var btn = links[i];
            if (btn.dataset.directBackHandler === '1') continue;
            btn.dataset.directBackHandler = '1';
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchToTab('home');
            });
        }
    }

    // ============================================================
    // 4. ПЕРЕРИСОВКА SPARKLINE ПРИ ВОЗВРАТЕ НА ГЛАВНУЮ
    // ============================================================
    function installHomeSparklineRefresh() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.nav-btn[data-tab="home"], .bn-btn[data-tab="home"]');
            if (!btn) return;
            setTimeout(function () {
                if (window.currentData && window.currentData.online_history) {
                    if (typeof window.drawSparkline === 'function') {
                        try { window.drawSparkline(window.currentData.online_history); } catch (err) {}
                    }
                }
                if (typeof window.renderNightLights === 'function') {
                    try { window.renderNightLights(); } catch (err) {}
                }
            }, 120);
        });
    }

    // ============================================================
    // 5. ПЕРВИЧНАЯ / ПЕРИОДИЧЕСКАЯ ПЕРЕРИСОВКА SPARKLINE
    // ============================================================
    function redrawSparklineIfReady() {
        var data = window.currentData;
        if (!data || !data.online_history) return;
        if (typeof window.drawSparkline !== 'function') return;
        try { window.drawSparkline(data.online_history); } catch (e) {}
    }

    var lastUpdatedAt = 0;
    var backLinkSweep = 0;
    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(redrawSparklineIfReady, 400);
            }
            // v1.2: периодически проверяем back-link (на случай позднего рендера)
            if (backLinkSweep < 20) {
                backLinkSweep++;
                installBackLinks();
            }
        } catch (e) {}
        setTimeout(tick, 2000);
    }

    // ============================================================
    // 6. BOOT
    // ============================================================
    function boot() {
        installIpCopy();
        installHomeButtons();
        installBackLinks();
        installHomeSparklineRefresh();

        setTimeout(redrawSparklineIfReady, 500);
        setTimeout(redrawSparklineIfReady, 1500);
        setTimeout(redrawSparklineIfReady, 3000);

        // Догоняющие попытки — если about-tab отрендерится позже
        setTimeout(installBackLinks, 500);
        setTimeout(installBackLinks, 1500);
        setTimeout(installBackLinks, 3500);

        if (window.PanelIcons && window.PanelIcons.autoReplace) {
            window.PanelIcons.autoReplace(document.body);
        }

        tick();
        console.log('[Home] v1.2 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.Home = {
        copyIp: function () {
            var btn = document.querySelector('[data-copy-ip]');
            if (btn) btn.click();
        },
        goHome: function () {
            switchToTab('home');
        }
    };
})();
