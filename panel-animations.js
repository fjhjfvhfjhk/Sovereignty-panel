/* ============================================================
   SOVEREIGNTY PANEL · PANEL-ANIMATIONS.JS v2.0
   ============================================================
   Триггеры всех 15 анимаций на реальных элементах панели.

   Работает в связке с panel-animations.css.
   Уважает настройку panel_animations (0 — выключено).
   Уважает html.no-animations (класс из panel-settings.js).

   Анимации:
     1.1 Ink write  — .panel h2 при переключении вкладок
     1.2 Wax seal   — при открытии country-passport / player-modal
     1.3 Ink drop   — под активной .nav-btn / .bn-btn
     1.4 Counter    — .stat-value при первой загрузке
     1.5 Page curl  — CSS hover, здесь ничего не нужно
     2.1 Compass    — CSS ::before, здесь ничего не нужно
     2.2 Chart draw — .sparkline-wrap при первом рендере
     2.3 Marker     — CSS, здесь ничего не нужно
     2.4 Day/night  — CSS transition, здесь ничего не нужно
     2.5 Border wave— при переключении на вкладку Карта
     3.1 Event drop — на новых записях в ленте
     3.2 War flash  — при новом war_declared в JSON
     3.3 Candle     — CSS на #server-name
     3.4 Unroll     — при входе на Хроники
     3.5 NEW dot    — на новых записях

   ПОДКЛЮЧЕНИЕ: последним скриптом в index.html.
     <script src="panel-animations.js?v=2.0"></script>
   ============================================================ */
(function () {
    'use strict';

    /* ------------------------------------------------------------
       Проверка, включены ли анимации
       ------------------------------------------------------------ */
    function animsEnabled() {
        try {
            if (localStorage.getItem('panel_animations') === '0') return false;
            if (document.documentElement.classList.contains('no-animations')) return false;
        } catch (e) {}
        return true;
    }

    /* Не даём повторять анимацию, если она уже играет на элементе */
    function oneShot(el, className, duration) {
        if (!el) return;
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
        if (duration) {
            setTimeout(function () {
                el.classList.remove(className);
            }, duration);
        }
    }

    /* ============================================================
       1.1 · INK WRITE при переключении вкладок
       ============================================================ */
    function installInkWrite() {
        function animateActiveTab() {
            if (!animsEnabled()) return;
            var active = document.querySelector('.tab-content.active');
            if (!active) return;
            var h2s = active.querySelectorAll('.panel h2');
            for (var i = 0; i < h2s.length; i++) {
                (function (h2, idx) {
                    setTimeout(function () {
                        oneShot(h2, 'sa-ink-write', 1000);
                    }, idx * 80);
                })(h2s[i], i);
            }
        }

        // Слушаем клик по любой кнопке навигации
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.main-nav .nav-btn, .bottom-nav .bn-btn');
            if (!btn) return;
            setTimeout(animateActiveTab, 100);
        });

        // Первая отрисовка после загрузки данных
        setTimeout(animateActiveTab, 1200);
    }

    /* ============================================================
       1.2 · WAX SEAL при открытии модалок
       ============================================================ */
    var waxSealOverlay = null;

    function getWaxSealOverlay() {
        if (waxSealOverlay && waxSealOverlay.parentNode) return waxSealOverlay;
        waxSealOverlay = document.createElement('div');
        waxSealOverlay.className = 'sa-wax-seal-overlay';
        waxSealOverlay.innerHTML = '<div class="sa-wax-seal">S</div>';
        waxSealOverlay.style.display = 'none';
        document.body.appendChild(waxSealOverlay);
        return waxSealOverlay;
    }

    function playWaxSeal() {
        if (!animsEnabled()) return;
        var ov = getWaxSealOverlay();
        var seal = ov.querySelector('.sa-wax-seal');
        ov.style.display = 'grid';
        seal.classList.remove('sa-wax-seal-anim');
        void seal.offsetWidth;
        seal.classList.add('sa-wax-seal-anim');
        setTimeout(function () {
            ov.style.display = 'none';
        }, 2100);
    }

    function installWaxSeal() {
        var tries = 0;
        function tryHook() {
            tries++;

            // Паспорт страны
            if (typeof window.openCountryPassport === 'function' && !window.openCountryPassport.__saWrapped) {
                var origPassport = window.openCountryPassport;
                var wrapped = function () {
                    playWaxSeal();
                    return origPassport.apply(this, arguments);
                };
                wrapped.__saWrapped = true;
                window.openCountryPassport = wrapped;
            }

            // Модалка игрока
            if (typeof window.openPlayer === 'function' && !window.openPlayer.__saWrapped) {
                var origPlayer = window.openPlayer;
                var wrapped2 = function () {
                    playWaxSeal();
                    return origPlayer.apply(this, arguments);
                };
                wrapped2.__saWrapped = true;
                window.openPlayer = wrapped2;
            }

            var hooked = (window.openCountryPassport && window.openCountryPassport.__saWrapped) &&
                         (window.openPlayer && window.openPlayer.__saWrapped);
            if (!hooked && tries < 50) setTimeout(tryHook, 100);
        }
        tryHook();
    }

    /* ============================================================
       1.3 · INK DROP под активной вкладкой
       ============================================================ */
    function installInkDrop() {
        document.addEventListener('click', function (e) {
            if (!animsEnabled()) return;
            var btn = e.target.closest('.nav-btn, .bn-btn, .tab');
            if (!btn) return;
            // Не накладываем дважды
            if (btn.querySelector('.sa-ink-drop')) return;
            var drop = document.createElement('span');
            drop.className = 'sa-ink-drop';
            btn.appendChild(drop);
            setTimeout(function () {
                if (drop.parentNode) drop.parentNode.removeChild(drop);
            }, 800);
        });
    }

    /* ============================================================
       1.4 · COUNTER для .stat-value
       ============================================================ */
    var counterDone = false;

    function parseFormatted(text) {
        if (!text) return null;
        var s = String(text).trim();
        if (s === '—' || s === '-' || s === '') return null;
        var mult = 1;
        if (/[kKкК]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
        else if (/[mMмМ]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
        var n = parseFloat(s.replace(/\s/g, '').replace(/,/g, '.'));
        if (isNaN(n)) return null;
        return n * mult;
    }

    function formatDuring(val, original) {
        if (/[kKкК]$/.test(original)) return (val / 1e3).toFixed(1) + 'k';
        if (/[mMмМ]$/.test(original)) return (val / 1e6).toFixed(2) + 'M';
        if (original.indexOf('.') !== -1) return val.toFixed(1);
        return Math.round(val).toString();
    }

    function animateCounters() {
        if (!animsEnabled()) return;
        var ids = [
            'countries-count',
            'total-claims',
            'total-bank',
            'total-energy',
            'total-players'
        ];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var original = el.textContent;
            var target = parseFormatted(original);
            if (target === null || target === 0) return;

            var start = performance.now();
            var duration = 850;
            el.classList.add('sa-counting');

            function tick(now) {
                var t = Math.min(1, (now - start) / duration);
                var eased = 1 - Math.pow(1 - t, 3);
                var val = target * eased;
                if (t >= 1) {
                    el.textContent = original;
                    el.classList.remove('sa-counting');
                    return;
                }
                el.textContent = formatDuring(val, original);
                requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        });
    }

    function installCounter() {
        var lastUpdated = 0;
        var iv = setInterval(function () {
            var d = window.currentData;
            if (!d || !d.updated_at) return;
            if (d.updated_at === lastUpdated) return;
            lastUpdated = d.updated_at;
            if (counterDone) {
                clearInterval(iv);
                return;
            }
            counterDone = true;
            setTimeout(animateCounters, 350);
            clearInterval(iv);
        }, 500);
    }

    /* ============================================================
       2.2 · CHART DRAW на sparkline
       ============================================================ */
    function installChartDraw() {
        var lastUpdated = 0;
        var firstDraw = true;
        var iv = setInterval(function () {
            var d = window.currentData;
            if (!d || !d.updated_at) return;
            if (d.updated_at === lastUpdated) return;
            lastUpdated = d.updated_at;
            if (!firstDraw) {
                clearInterval(iv);
                return;
            }
            firstDraw = false;
            var wrap = document.querySelector('#panel-online-chart .sparkline-wrap');
            if (wrap) {
                setTimeout(function () {
                    if (animsEnabled()) {
                        oneShot(wrap, 'sa-chart-draw', 1400);
                    }
                }, 500);
            }
            clearInterval(iv);
        }, 500);
    }

    /* ============================================================
       2.5 · BORDER WAVE при входе на Карту
       ============================================================ */
    function playBorderWave() {
        if (!animsEnabled()) return;
        var vp = document.getElementById('map-viewport');
        if (!vp) return;
        var old = vp.querySelector('.sa-border-wave');
        if (old) old.remove();
        var wave = document.createElement('div');
        wave.className = 'sa-border-wave';
        vp.appendChild(wave);
        setTimeout(function () {
            if (wave.parentNode) wave.parentNode.removeChild(wave);
        }, 1600);
    }

    function installBorderWave() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.nav-btn[data-tab="map"], .bn-btn[data-tab="map"]');
            if (!btn) return;
            setTimeout(playBorderWave, 250);
        });
    }

    /* ============================================================
       3.1 + 3.5 · EVENT DROP + NEW DOT на новых записях
       ============================================================ */
    var seenHashes = {};

    function hashNode(node) {
        if (!node) return '';
        return (node.textContent || '').trim().substring(0, 80);
    }

    function markNewItems(container, itemSelector, stateKey) {
        if (!animsEnabled()) return;
        var items = container.querySelectorAll(itemSelector);
        var seen = seenHashes[stateKey] || {};
        var isFirstRender = !seenHashes[stateKey];
        var newSeen = {};

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var h = hashNode(item);
            newSeen[h] = true;

            // На первой отрисовке — не анимируем
            if (isFirstRender) continue;

            // Уже видели — не мигаем
            if (seen[h]) continue;

            // Только первые три сверху
            if (i > 2) continue;

            item.classList.remove('sa-event-drop');
            void item.offsetWidth;
            item.classList.add('sa-event-drop');

            // Точка «NEW»
            var oldDot = item.querySelector('.sa-new-dot');
            if (oldDot) oldDot.remove();
            var dot = document.createElement('span');
            dot.className = 'sa-new-dot sa-pulse';
            item.appendChild(dot);
            setTimeout(function (d) {
                return function () {
                    if (d.parentNode) d.parentNode.removeChild(d);
                };
            }(dot), 3300);
        }

        seenHashes[stateKey] = newSeen;
    }

    function installEventDrop() {
        var logList = document.getElementById('event-log-list');
        var chrFeed = document.getElementById('chr-feed');

        if (logList) {
            var mo1 = new MutationObserver(function () {
                setTimeout(function () {
                    markNewItems(logList, '.event-log-item', 'log');
                }, 60);
            });
            mo1.observe(logList, { childList: true });
        }

        if (chrFeed) {
            var mo2 = new MutationObserver(function () {
                setTimeout(function () {
                    markNewItems(chrFeed, '.chr-event', 'chr');
                }, 60);
            });
            mo2.observe(chrFeed, { childList: true });
        }
    }

    /* ============================================================
       3.2 · WAR FLASH при новом war_declared
       ============================================================ */
    var seenWarTs = null;

    function playWarFlash(attacker, defender) {
        if (!animsEnabled()) return;

        // Оверлей-вспышка
        var ov = document.createElement('div');
        ov.className = 'sa-war-overlay sa-war-flash';
        document.body.appendChild(ov);
        setTimeout(function () {
            if (ov.parentNode) ov.parentNode.removeChild(ov);
        }, 1300);

        // Тост сверху
        var toast = document.createElement('div');
        toast.className = 'sa-war-toast';
        var text = (attacker || '?') + ' ⚔ ' + (defender || '?');
        toast.innerHTML = '<b>' + escapeHtml(attacker || '?') + '</b> объявила войну <b>' +
                          escapeHtml(defender || '?') + '</b>';
        document.body.appendChild(toast);
        requestAnimationFrame(function () {
            toast.classList.add('sa-war-toast-show');
        });
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3200);
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function installWarFlash() {
        var lastUpdated = 0;
        setInterval(function () {
            var d = window.currentData;
            if (!d || !d.updated_at) return;
            if (d.updated_at === lastUpdated) return;
            lastUpdated = d.updated_at;

            var events = d.event_log || [];
            var warEvents = events.filter(function (e) {
                return e && e.type === 'war_declared';
            });

            if (seenWarTs === null) {
                // Первая загрузка — запоминаем все существующие
                seenWarTs = {};
                warEvents.forEach(function (e) { seenWarTs[e.ts] = true; });
                return;
            }

            // Ищем новые
            warEvents.forEach(function (e) {
                if (seenWarTs[e.ts]) return;
                seenWarTs[e.ts] = true;
                // Парсим сообщение «X объявила войну Y»
                var attacker = '', defender = '';
                if (e.message) {
                    var m = e.message.match(/^(.+?)\s+объявил[аи]?\s+войну\s+(.+)$/);
                    if (m) {
                        attacker = m[1].trim();
                        defender = m[2].trim();
                    }
                }
                playWarFlash(attacker, defender);
            });
        }, 1500);
    }

    /* ============================================================
       3.4 · UNROLL при входе на Хроники
       ============================================================ */
    function playUnroll() {
        if (!animsEnabled()) return;
        var feed = document.getElementById('chr-feed');
        if (feed) {
            oneShot(feed, 'sa-unroll', 900);
        }
    }

    function installUnroll() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.nav-btn[data-tab="chronicles"], .bn-btn[data-tab="chronicles"]');
            if (!btn) return;
            setTimeout(playUnroll, 200);
        });
    }

    /* ============================================================
       Обработка сохранения настроек
       ============================================================ */
    function installSettingsWatcher() {
        window.addEventListener('storage', function (e) {
            if (e.key === 'panel_animations' && e.newValue === '1') {
                // Анимации включили — можно перезапустить счётчик
                counterDone = false;
            }
        });
    }

    /* ============================================================
       BOOT
       ============================================================ */
    function boot() {
        installInkWrite();
        installWaxSeal();
        installInkDrop();
        installCounter();
        installChartDraw();
        installBorderWave();
        installEventDrop();
        installWarFlash();
        installUnroll();
        installSettingsWatcher();
        console.log('[PanelAnimations] v2.0 ready (15 animations, 3 packs)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelAnimations = {
        playWaxSeal: playWaxSeal,
        playWarFlash: playWarFlash,
        playBorderWave: playBorderWave,
        playUnroll: playUnroll,
        animateCounters: animateCounters
    };
})();
