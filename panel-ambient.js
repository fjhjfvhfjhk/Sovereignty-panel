/* ============================================================
   SOVEREIGNTY PANEL · PANEL-AMBIENT.JS v1.0
   ============================================================
   Фаза 1 внедрения анимаций из lux-7-демо.

   Что делает:
     1. Создаёт #ambient и #particles (если их нет в DOM).
     2. Красит ambient в зависимости от состояния мира
        (война / мир / ивент).
     3. Рисует лёгкий particle layer, крашенный в ambient.
     4. Ripple на кнопках (nav-btn, map-btn, tab, btn, etc.).
     5. Number pop — числа «подпрыгивают» при обновлении.
     6. Pulse-бейджи: «⚔ в войне» и «свежие данные».
     7. Stagger event-log-item через CSS-переменную --idx.

   Подключать ПОСЛЕ app.js:
     <script src="app.js?v=5.9"></script>
     <script src="panel-ambient.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    var AMB_STATE_KEY = 'panel_ambient_state';

    // ============================================================
    // 1. DOM-контейнеры
    // ============================================================
    function ensureContainers() {
        if (!document.getElementById('ambient')) {
            var amb = document.createElement('div');
            amb.id = 'ambient';
            amb.setAttribute('aria-hidden', 'true');
            document.body.insertBefore(amb, document.body.firstChild);
        }
        if (!document.getElementById('particles')) {
            var cv = document.createElement('canvas');
            cv.id = 'particles';
            cv.setAttribute('aria-hidden', 'true');
            var amb = document.getElementById('ambient');
            if (amb && amb.nextSibling) document.body.insertBefore(cv, amb.nextSibling);
            else document.body.insertBefore(cv, document.body.firstChild);
        }
    }

    // ============================================================
    // 2. Ambient state
    // ============================================================
    function readAmbientRGB() {
        var cs = getComputedStyle(document.body);
        return [
            parseInt(cs.getPropertyValue('--amb-r')) || 99,
            parseInt(cs.getPropertyValue('--amb-g')) || 102,
            parseInt(cs.getPropertyValue('--amb-b')) || 241
        ];
    }

    /**
     * Определяет состояние мира по currentData.
     *   war   — есть страны с active_wars > 0
     *   event — идёт ивент (пока не используется, задел)
     *   peace — по умолчанию (бренд-индиго)
     */
    function computeState(data) {
        if (!data) return '';
        var countries = data.countries || [];
        var totalWars = 0;
        for (var i = 0; i < countries.length; i++) {
            totalWars += (countries[i].active_wars || 0);
        }
        if (totalWars > 0) return 'war';

        // Задел под будущие ивенты — пока всегда null.
        // Когда EventManager начнёт экспортировать active_event,
        // здесь будет проверка.
        // if (data.active_event) return 'event';

        return '';
    }

    function applyState(state) {
        try {
            var prev = localStorage.getItem(AMB_STATE_KEY) || '';
            localStorage.setItem(AMB_STATE_KEY, state);
            if (prev === state) return;
        } catch (e) {}

        if (state) document.body.dataset.state = state;
        else delete document.body.dataset.state;
    }

    // ============================================================
    // 3. Particle layer
    // ============================================================
    function startParticles() {
        var cv = document.getElementById('particles');
        if (!cv) return;

        var ctx = cv.getContext('2d');
        var DPR = Math.min(window.devicePixelRatio || 1, 2);
        var parts = [];
        var targetRGB = [99, 102, 241];
        var currentRGB = [99, 102, 241];

        function resize() {
            cv.width = window.innerWidth * DPR;
            cv.height = window.innerHeight * DPR;
            cv.style.width = window.innerWidth + 'px';
            cv.style.height = window.innerHeight + 'px';

            var n = Math.min(60, Math.round(window.innerWidth / 25));
            parts = [];
            for (var i = 0; i < n; i++) {
                parts.push({
                    x: Math.random() * cv.width,
                    y: Math.random() * cv.height,
                    r: (Math.random() * 1.3 + 0.4) * DPR,
                    vx: (Math.random() - 0.5) * 0.18 * DPR,
                    vy: (Math.random() - 0.5) * 0.18 * DPR,
                    a: Math.random() * 0.5 + 0.25
                });
            }
        }

        function smoothRGB() {
            for (var i = 0; i < 3; i++) {
                currentRGB[i] += (targetRGB[i] - currentRGB[i]) * 0.04;
            }
        }

        function tick() {
            ctx.clearRect(0, 0, cv.width, cv.height);
            smoothRGB();
            var R = currentRGB[0] | 0;
            var G = currentRGB[1] | 0;
            var B = currentRGB[2] | 0;

            for (var i = 0; i < parts.length; i++) {
                var p = parts[i];
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x += cv.width;
                if (p.x > cv.width) p.x -= cv.width;
                if (p.y < 0) p.y += cv.height;
                if (p.y > cv.height) p.y -= cv.height;

                var rad = p.r * 5;
                var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
                g.addColorStop(0, 'rgba(' + R + ',' + G + ',' + B + ',' + p.a + ')');
                g.addColorStop(1, 'rgba(' + R + ',' + G + ',' + B + ',0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(tick);
        }

        window.addEventListener('resize', resize, { passive: true });
        resize();
        tick();

        // Экспортируем функцию смены цвета частиц
        window.__panelParticles_setRGB = function (r, g, b) {
            targetRGB[0] = r; targetRGB[1] = g; targetRGB[2] = b;
        };
    }

    // ============================================================
    // 4. Ripple на кнопках
    // ============================================================
    function installRipple() {
        var selectors = [
            '.nav-btn', '.map-btn', '.btn-badge', '.tab',
            '.player-modal-btn', '.player-copy-btn', '.btn',
            '.icon-btn', '.map-layers-close', '.map-layers-restore'
        ];
        var sel = selectors.join(',');

        document.body.addEventListener('click', function (e) {
            var btn = e.target.closest(sel);
            if (!btn || btn.disabled) return;

            // Пропускаем кнопки, у которых уже есть ripple-анимация от lux
            if (btn.querySelector('.panel-ripple')) return;

            var r = btn.getBoundingClientRect();
            var size = Math.max(r.width, r.height);
            if (size === 0) return;

            var s = document.createElement('span');
            s.className = 'panel-ripple';
            s.style.width = s.style.height = size + 'px';
            s.style.left = (e.clientX - r.left - size / 2) + 'px';
            s.style.top = (e.clientY - r.top - size / 2) + 'px';
            btn.appendChild(s);
            setTimeout(function () { s.remove(); }, 700);
        }, true);
    }

    // ============================================================
    // 5. Number pop
    // ============================================================
    function installNumberPop() {
        var targetClasses = ['stat-value', 'num', 'jackpot-value'];
        var popObs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                var el = m.target;
                if (el.nodeType === 3) el = el.parentElement;
                if (!el || !el.classList) continue;
                var hit = false;
                for (var j = 0; j < targetClasses.length; j++) {
                    if (el.classList.contains(targetClasses[j])) { hit = true; break; }
                }
                if (!hit) continue;
                if (el.classList.contains('pop')) continue;
                el.classList.add('pop');
                (function (target) {
                    setTimeout(function () { target.classList.remove('pop'); }, 500);
                })(el);
            }
        });
        popObs.observe(document.body, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    // ============================================================
    // 6. Pulse-бейджи
    // ============================================================
    function updatePulseBadges(data) {
        var onlineBadge = document.getElementById('online-badge');

        // ⚔ в войне
        if (onlineBadge) {
            var countries = (data && data.countries) || [];
            var totalWars = 0;
            for (var i = 0; i < countries.length; i++) {
                totalWars += (countries[i].active_wars || 0);
            }
            onlineBadge.classList.toggle('pulse-war', totalWars > 0);
            if (totalWars > 0) {
                onlineBadge.title = 'Активных войн: ' + totalWars;
            } else {
                onlineBadge.removeAttribute('title');
            }
        }

        // 🟢 свежие данные
        var updatedBadge = document.getElementById('updated-badge');
        if (updatedBadge && data && data.updated_at) {
            var age = Date.now() - data.updated_at;
            var isFresh = age < 60 * 1000;
            updatedBadge.classList.toggle('pulse-live', isFresh);
        }
    }

    // ============================================================
    // 7. Event log stagger
    // ============================================================
    function restaggerEventLog() {
        var items = document.querySelectorAll('#event-log-list .event-log-item');
        for (var i = 0; i < items.length; i++) {
            items[i].style.setProperty('--idx', i);
        }
    }

    // ============================================================
    // 8. Хук на обновление данных
    // ============================================================
    function installDataHook() {
        // app.js определяет window.renderMeta и др. как глобальные?
        // Нет — только через Object.assign(window, ...) в других модулях.
        // Используем polling на currentData.updated_at — самый надёжный способ.
        var lastUpdatedAt = 0;

        function check() {
            try {
                var data = window.currentData;
                if (data && data.updated_at && data.updated_at !== lastUpdatedAt) {
                    lastUpdatedAt = data.updated_at;
                    onDataRefreshed(data);
                }
            } catch (e) {}
            setTimeout(check, 1500);
        }
        check();
    }

    function onDataRefreshed(data) {
        var state = computeState(data);
        applyState(state);

        var rgb = readAmbientRGB();
        if (window.__panelParticles_setRGB) {
            window.__panelParticles_setRGB(rgb[0], rgb[1], rgb[2]);
        }

        updatePulseBadges(data);
        restaggerEventLog();
    }

    // При смене data-state перекрашиваем частицы
    function installStateObserver() {
        var obs = new MutationObserver(function () {
            var rgb = readAmbientRGB();
            if (window.__panelParticles_setRGB) {
                window.__panelParticles_setRGB(rgb[0], rgb[1], rgb[2]);
            }
        });
        obs.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-state']
        });
    }

    // ============================================================
    // Boot
    // ============================================================
    function boot() {
        ensureContainers();
        startParticles();
        installRipple();
        installNumberPop();
        installStateObserver();
        installDataHook();

        // Разовый запуск с уже имеющимися данными
        try {
            if (window.currentData) onDataRefreshed(window.currentData);
        } catch (e) {}

        // Если данные не пришли за 4 сек — применим дефолт (brand)
        setTimeout(function () {
            if (!document.body.dataset.state) {
                var rgb = readAmbientRGB();
                if (window.__panelParticles_setRGB) {
                    window.__panelParticles_setRGB(rgb[0], rgb[1], rgb[2]);
                }
            }
        }, 4000);

        console.log('[PanelAmbient] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Публичный API — на случай, если нужно ручное управление
    window.PanelAmbient = {
        setState: applyState,
        refresh: function () {
            if (window.currentData) onDataRefreshed(window.currentData);
        }
    };
})();
