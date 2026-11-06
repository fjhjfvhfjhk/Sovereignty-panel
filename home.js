/* ============================================================
   SOVEREIGNTY PANEL · HOME.JS v1.0
   ============================================================
   Логика главной страницы:
     1. Копирование IP-адреса сервера по кнопке.
     2. Навигация через 6 больших кнопок (data-home-tab).
     3. Перерисовка sparkline при возврате на главную.
     4. Обновление каунтеров после загрузки данных.

   Подключать ПОСЛЕ app.js (нужны copyToClipboard, showToast, drawSparkline).
   ============================================================ */
(function () {
    'use strict';

    var SERVER_IP = 'sovereignty.millida.host';

    // ============================================================
    // 1. КОПИРОВАНИЕ IP
    // ============================================================
    function installIpCopy() {
        var btn = document.getElementById('home-ip-copy');
        if (!btn) return;
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', function () {
            var originalText = btn.textContent;

            function showSuccess() {
                btn.textContent = '✓ Скопировано';
                btn.classList.add('copied');
                if (typeof window.showToast === 'function') {
                    window.showToast('IP скопирован: ' + SERVER_IP);
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
                window.copyToClipboard(SERVER_IP).then(function (ok) {
                    if (ok) showSuccess();
                    else showFail();
                }).catch(showFail);
            } else {
                // Fallback
                try {
                    var ta = document.createElement('textarea');
                    ta.value = SERVER_IP;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    var ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    if (ok) showSuccess();
                    else showFail();
                } catch (e) {
                    showFail();
                }
            }
        });
    }

    // ============================================================
    // 2. НАВИГАЦИЯ ЧЕРЕЗ КНОПКИ
    // ============================================================
    function installHomeButtons() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-home-tab]');
            if (!btn) return;
            var target = btn.getAttribute('data-home-tab');
            if (!target) return;

            var navBtn = document.querySelector(
                '.main-nav .nav-btn[data-tab="' + target + '"]'
            );
            if (navBtn) {
                navBtn.click();
            } else {
                // Fallback: переключить вручную
                document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) {
                    b.classList.toggle('active', b.dataset.tab === target);
                });
                document.querySelectorAll('.tab-content').forEach(function (c) {
                    c.classList.toggle('active', c.id === 'tab-' + target);
                });
                var tab = document.getElementById('tab-' + target);
                if (tab) tab.classList.add('active');
            }

            // Прокрутить наверх
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ============================================================
    // 3. ПЕРЕРИСОВКА SPARKLINE ПРИ ВОЗВРАТЕ НА ГЛАВНУЮ
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
                // Перерисовка световых точек и маркеров, если они есть
                if (typeof window.renderNightLights === 'function') {
                    try { window.renderNightLights(); } catch (err) {}
                }
            }, 120);
        });
    }

    // ============================================================
    // 4. ПЕРВИЧНАЯ ПЕРЕРИСОВКА SPARKLINE
    // ============================================================
    function redrawSparklineIfReady() {
        var data = window.currentData;
        if (!data || !data.online_history) return;
        if (typeof window.drawSparkline !== 'function') return;
        try { window.drawSparkline(data.online_history); } catch (e) {}
    }

    // ============================================================
    // 5. НАБЛЮДАТЕЛЬ ЗА ДАННЫМИ — при обновлении вызываем перерисовку
    // ============================================================
    var lastUpdatedAt = 0;
    function tick() {
        try {
            var data = window.currentData;
            if (data && data.updated_at && data.updated_at !== lastUpdatedAt) {
                lastUpdatedAt = data.updated_at;
                setTimeout(redrawSparklineIfReady, 400);
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
        installHomeSparklineRefresh();

        // Несколько попыток первичной отрисовки sparkline
        setTimeout(redrawSparklineIfReady, 500);
        setTimeout(redrawSparklineIfReady, 1500);
        setTimeout(redrawSparklineIfReady, 3000);

        // Досрочно применяем data-icon на кнопки — если PanelIcons уже загрузился
        if (window.PanelIcons && window.PanelIcons.autoReplace) {
            window.PanelIcons.autoReplace(document.body);
        }

        tick();
        console.log('[Home] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.Home = {
        copyIp: function () {
            var btn = document.getElementById('home-ip-copy');
            if (btn) btn.click();
        }
    };
})();
