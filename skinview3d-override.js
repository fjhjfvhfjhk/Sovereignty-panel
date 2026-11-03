/* ============================================================
   SOVEREIGNTY PANEL · SKINVIEW3D-OVERRIDE.JS v1.0
   ============================================================
   Заменяет ручной CSS-рендер скина (skin3d.js) на настоящий
   3D-просмотрщик skinview3d (CDN).

   Как работает:
     1. Lazy-загружает skinview3d с jsdelivr (fallback — unpkg).
     2. Переопределяет window.initSkinViewer(name, uuid).
     3. Возвращает совместимый state: autoRotate getter/setter,
        dispose(), apply() (no-op), rotation/rotationX (dummy).

   Что НЕ трогаем:
     - app.js   (правило проекта).
     - skin3d.js (остаётся fallback — CSS 3D).
     - index.html/CSS модалки игрока.

   Если CDN недоступен — вызывается оригинальный initSkinViewer
   и работа продолжается на старом CSS-рендере.

   Подключение (в index.html, СТРОГО после app.js):
     <script src="app.js?v=5.9"></script>
     <script src="skinview3d-override.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    var CDN_PRIMARY  = 'https://cdn.jsdelivr.net/npm/skinview3d@3/bundles/skinview3d.bundle.js';
    var CDN_FALLBACK = 'https://unpkg.com/skinview3d@3/bundles/skinview3d.bundle.js';

    var libPromise = null;
    var libLoaded  = false;
    var generation = 0;   /* защита от гонки при быстром close/open */

    /* ============================================================
       1. Загрузка библиотеки
       ============================================================ */
    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = function () {
                if (window.skinview3d) resolve(window.skinview3d);
                else reject(new Error('skinview3d missing on window'));
            };
            s.onerror = function () { reject(new Error('load failed: ' + url)); };
            document.head.appendChild(s);
        });
    }

    function loadSkinView3D() {
        if (window.skinview3d) { libLoaded = true; return Promise.resolve(window.skinview3d); }
        if (libPromise) return libPromise;

        libPromise = loadScript(CDN_PRIMARY)
            .catch(function (e) {
                console.warn('[Skinview3d] primary CDN failed:', e.message);
                return loadScript(CDN_FALLBACK);
            })
            .then(function (lib) {
                libLoaded = true;
                console.log('[Skinview3d] loaded from CDN');
                return lib;
            })
            .catch(function (err) {
                libPromise = null;
                console.error('[Skinview3d] all CDNs failed:', err);
                throw err;
            });
        return libPromise;
    }

    /* ============================================================
       2. Утилиты
       ============================================================ */
    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    /* ============================================================
       3. Управление анимацией вращения
       ============================================================ */
    function applyRotation(state) {
        var sv = window.skinview3d;
        if (!sv) return;

        try { state.viewer.animations.clear(); } catch (e) {}
        state._rotAnim = null;

        /* Idle — плавное покачивание всегда */
        try { state.viewer.animations.add(sv.IdleAnimation); } catch (e) {}

        /* Вращение — только когда autoRotate = true */
        if (state._auto) {
            try {
                state._rotAnim = new sv.RotatingAnimation(state.viewer);
                state.viewer.animations.add(state._rotAnim);
            } catch (e) {
                console.warn('[Skinview3d] RotatingAnimation failed:', e);
            }
        }
    }

    /* ============================================================
       4. Совместимый state для app.js
       ============================================================ */
    function createCompatState(viewer, canvas) {
        return {
            viewer: viewer,
            canvas: canvas,
            scene: canvas,          /* для совместимости, не используется */
            rotation: 0,            /* dummy — skinRotateLoop пишет, мы игнорируем */
            rotationX: 0,
            _auto: false,
            _rotAnim: null,

            get autoRotate() {
                return this._auto;
            },
            set autoRotate(v) {
                this._auto = !!v;
                applyRotation(this);
            },

            /* skinRotateLoop из app.js вызывает apply() каждый кадр — no-op.
               skinview3d сам крутит свой RAF. */
            apply: function () {},

            dispose: function () {
                try {
                    if (this._rotAnim && this.viewer.animations) {
                        this.viewer.animations.remove(this._rotAnim);
                        this._rotAnim = null;
                    }
                } catch (e) {}
                try { this.viewer.dispose(); } catch (e) {}
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            }
        };
    }

    /* ============================================================
       5. Переопределение initSkinViewer
       ============================================================ */
    function override() {
        if (typeof window.initSkinViewer !== 'function') return false;
        if (window.__skinview3dInstalled) return true;

        window.__skinview3dInstalled = true;
        var originalInit = window.initSkinViewer;
        window.__initSkinViewerOriginal = originalInit;

        window.initSkinViewer = function (name, uuid) {
            var wrap = document.getElementById('player-viewer-wrap');
            if (!wrap) return;

            var myGen = ++generation;

            /* Очищаем предыдущий viewer */
            if (window.currentSkinViewer) {
                try { window.currentSkinViewer.dispose(); } catch (e) {}
                window.currentSkinViewer = null;
            }
            var strayCanvas = wrap.querySelector('canvas.skinview3d-canvas');
            if (strayCanvas) strayCanvas.remove();
            var strayScene = wrap.querySelector('.skin-scene');
            if (strayScene) strayScene.remove();

            var loading = document.getElementById('skin-loading');
            if (loading) {
                loading.classList.remove('hidden');
                loading.innerHTML = '<div class="spinner"></div><div>Загрузка скина...</div>';
            }

            /* Резолвим URL скина через функцию app.js */
            var skinUrl = null;
            try {
                if (typeof window.resolveSkinUrl === 'function') {
                    skinUrl = window.resolveSkinUrl(name, uuid);
                }
            } catch (e) {
                console.warn('[Skinview3d] resolveSkinUrl failed:', e);
            }

            if (!skinUrl) {
                if (loading) {
                    loading.innerHTML =
                        '<div style="padding:20px;color:#ef4444;">Не удалось определить URL скина</div>';
                }
                return;
            }

            loadSkinView3D().then(function (lib) {
                /* Пока грузили CDN — юзер мог закрыть модалку или
                   открыть другого игрока. Проверяем. */
                if (myGen !== generation) return;
                var modal = document.getElementById('player-modal');
                if (!modal || !modal.classList.contains('show')) return;

                var w = wrap.clientWidth  || 360;
                var h = wrap.clientHeight || 360;
                if (w < 50 || h < 50) { w = 360; h = 360; }

                /* Canvas */
                var canvas = document.createElement('canvas');
                canvas.className = 'skinview3d-canvas';
                canvas.style.display = 'block';
                wrap.insertBefore(canvas, wrap.firstChild);

                var viewer;
                try {
                    viewer = new lib.SkinViewer({
                        canvas: canvas,
                        width: w,
                        height: h,
                        skin: skinUrl,
                        model: 'auto-detect',
                        ears: 'current',
                        enableControls: false,   /* orbit controls подключим сами */
                        nameTag: name
                    });
                } catch (e) {
                    console.error('[Skinview3d] SkinViewer init failed:', e);
                    canvas.remove();
                    if (loading) {
                        loading.innerHTML =
                            '<div style="padding:20px;color:#ef4444;">Ошибка 3D: ' +
                            escapeHtml(e.message) + '</div>';
                    }
                    /* Fallback на CSS-рендер */
                    try { originalInit.call(window, name, uuid); } catch (e2) {}
                    return;
                }

                /* Прозрачный фон — CSS-градиент обёртки виден */
                try { viewer.background = null; } catch (e) {}

                /* OrbitControls — вращение мышью */
                try {
                    var ctrl = lib.createOrbitControls(viewer);
                    ctrl.enableZoom    = false;
                    ctrl.enablePan     = false;
                    ctrl.rotateSpeed   = 0.9;
                    ctrl.enableDamping = true;
                    ctrl.dampingFactor = 0.08;
                } catch (e) {
                    console.warn('[Skinview3d] controls failed:', e);
                }

                /* Совместимый state */
                var state = createCompatState(viewer, canvas);
                state._auto = !window.rotatePaused;
                applyRotation(state);

                /* Resize — при повороте экрана/изменении окна */
                if (typeof ResizeObserver !== 'undefined') {
                    try {
                        var ro = new ResizeObserver(function () {
                            if (window.currentSkinViewer !== state) return;
                            var nw = wrap.clientWidth;
                            var nh = wrap.clientHeight;
                            if (nw < 10 || nh < 10) return;
                            try { viewer.setSize(nw, nh); } catch (e) {}
                        });
                        ro.observe(wrap);
                        var baseDispose = state.dispose.bind(state);
                        state.dispose = function () {
                            try { ro.disconnect(); } catch (e) {}
                            baseDispose();
                        };
                    } catch (e) {}
                }

                /* Кнопка «Ник» — переключаем viewer.nameTag через
                   addEventListener (onclick из app.js остаётся no-op,
                   т.к. #skin-nametag DOM-узла больше нет). */
                var nameBtn = document.getElementById('skin-toggle-name');
                if (nameBtn && !nameBtn.__skvHooked) {
                    nameBtn.__skvHooked = true;
                    nameBtn.addEventListener('click', function () {
                        if (window.currentSkinViewer && window.currentSkinViewer.viewer) {
                            var v = window.currentSkinViewer.viewer;
                            v.nameTag = v.nameTag ? null : name;
                        }
                    });
                }

                window.currentSkinViewer = state;
                if (loading) loading.classList.add('hidden');

                console.log('[Skinview3d] ready: ' + name + ' (' + w + 'x' + h + ')');
            }).catch(function (err) {
                if (myGen !== generation) return;
                console.error('[Skinview3d] CDN load failed:', err);
                if (loading) {
                    loading.innerHTML =
                        '<div style="padding:20px;color:#ef4444;">CDN недоступен. Fallback…</div>';
                }
                setTimeout(function () {
                    if (loading) loading.classList.add('hidden');
                    try { originalInit.call(window, name, uuid); } catch (e) {}
                }, 500);
            });
        };

        console.log('[Skinview3d] initSkinViewer override installed');
        return true;
    }

    /* ============================================================
       6. Boot
       ============================================================ */
    function preloadIdle() {
        /* Не блокируем первую отрисовку — грузим CDN в idle */
        if ('requestIdleCallback' in window) {
            requestIdleCallback(function () {
                loadSkinView3D().catch(function () {});
            }, { timeout: 6000 });
        } else {
            setTimeout(function () { loadSkinView3D().catch(function () {}); }, 4000);
        }
    }

    var tries = 0;
    function tryInstall() {
        tries++;
        if (override()) {
            preloadIdle();
            return;
        }
        if (tries < 50) setTimeout(tryInstall, 100);
        else console.warn('[Skinview3d] initSkinViewer not found after 50 tries');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInstall);
    } else {
        tryInstall();
    }

    window.Skinview3dOverride = {
        load: loadSkinView3D,
        isLoaded: function () { return libLoaded; }
    };
})();
