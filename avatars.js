/* ============================================================
   SOVEREIGNTY PANEL · AVATARS.JS v1.0
   ============================================================
   Гарантированный fallback для аватарок игроков.

   ПРОБЛЕМА:
     Внешние сервисы (mc-heads.net, crafatar.com) для пиратских
     ников возвращают «Steve по умолчанию» — одинаковую серую
     голову с закрытыми глазами. Все игроки выглядят одинаково.

   РЕШЕНИЕ:
     1. Приоритет — локальный скин из data/skins/{ник}.png.
     2. Если не загрузился — генерируем inline-SVG аватар
        с первой буквой ника и цветом по хешу.

   Что делает:
     - Расширяет существующий headCache.
     - Слушает ошибки загрузки <img> с data-pname.
     - Заменяет битую/дефолтную голову на SVG.
     - Работает и для таблицы стран, и для карточек игроков.

   Подключать ПОСЛЕ app.js, ДО panel-detail.js:
     <script src="app.js"></script>
     <script src="avatars.js"></script>
     <script src="panel-detail.js"></script>
   ============================================================ */
(function () {
    'use strict';

    var LOCAL_SKIN_DIR = 'data/skins/';
    var SKIN_TIMEOUT_MS = 3000;
    var FALLBACK_COLORS = [
        '#6366f1', '#818cf8', '#a78bfa', '#c084fc',
        '#e879f9', '#f472b6', '#fb7185', '#f97316',
        '#fbbf24', '#84cc16', '#22c55e', '#14b8a6',
        '#06b6d4', '#0ea5e9', '#3b82f6'
    ];

    // Внутренний кэш: имя → dataURL или 'fail'
    var localCache = new Map();
    var pending = new Map();

    // ============================================================
    // 1. Хеш ника → цвет
    // ============================================================
    function hashName(name) {
        var h = 0;
        for (var i = 0; i < name.length; i++) {
            h = ((h << 5) - h) + name.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    function colorFor(name) {
        if (!name) return FALLBACK_COLORS[0];
        return FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length];
    }

    // ============================================================
    // 2. Генератор SVG-аватара
    // ============================================================
    function makeSvgAvatar(name, size) {
        size = size || 64;
        name = String(name || '?');
        var letter = name.charAt(0).toUpperCase();
        var color = colorFor(name);
        var darker = shadeColor(color, -25);

        // Градиент + буква
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + size + '" height="' + size + '">' +
                '<defs>' +
                    '<linearGradient id="g' + hashName(name) + '" x1="0" y1="0" x2="0" y2="1">' +
                        '<stop offset="0%" stop-color="' + color + '"/>' +
                        '<stop offset="100%" stop-color="' + darker + '"/>' +
                    '</linearGradient>' +
                '</defs>' +
                '<rect width="64" height="64" rx="8" fill="url(#g' + hashName(name) + ')"/>' +
                '<text x="32" y="43" text-anchor="middle" ' +
                       'font-family="Georgia, serif" font-size="34" font-weight="800" ' +
                       'fill="rgba(255,255,255,0.92)" ' +
                       'stroke="rgba(0,0,0,0.15)" stroke-width="0.5">' +
                    escapeXml(letter) +
                '</text>' +
            '</svg>';

        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function shadeColor(hex, percent) {
        var num = parseInt(hex.replace('#', ''), 16);
        var r = Math.max(0, Math.min(255, (num >> 16) + percent));
        var g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
        var b = Math.max(0, Math.min(255, (num & 0xff) + percent));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    function escapeXml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ============================================================
    // 3. Загрузка локального скина
    // ============================================================
    function loadLocalSkin(name) {
        if (localCache.has(name)) return Promise.resolve(localCache.get(name));
        if (pending.has(name)) return pending.get(name);

        var url = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
        var promise = new Promise(function (resolve) {
            var img = new Image();
            var done = false;
            var timer = setTimeout(function () {
                if (done) return;
                done = true;
                localCache.set(name, 'fail');
                resolve('fail');
            }, SKIN_TIMEOUT_MS);

            img.onload = function () {
                if (done) return;
                done = true;
                clearTimeout(timer);
                // Проверяем размер — скины 64×64 или 64×32
                if (img.width < 32 || img.height < 32) {
                    localCache.set(name, 'fail');
                    resolve('fail');
                    return;
                }
                try {
                    var headUrl = headFromSkin(img);
                    localCache.set(name, headUrl);
                    resolve(headUrl);
                } catch (e) {
                    localCache.set(name, 'fail');
                    resolve('fail');
                }
            };
            img.onerror = function () {
                if (done) return;
                done = true;
                clearTimeout(timer);
                localCache.set(name, 'fail');
                resolve('fail');
            };
            img.src = url;
        });

        pending.set(name, promise);
        return promise;
    }

    /** Вырезает голову из полного скина (регион 8×8 на 8,8 + overlay 40,8). */
    function headFromSkin(skinImg) {
        var c = document.createElement('canvas');
        c.width = 8;
        c.height = 8;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(skinImg, 8, 8, 8, 8, 0, 0, 8, 8);
        if (skinImg.width >= 64 && skinImg.height >= 64) {
            // Накладываем overlay (слой шляпы)
            ctx.drawImage(skinImg, 40, 8, 8, 8, 0, 0, 8, 8);
        }
        return c.toDataURL('image/png');
    }

    // ============================================================
    // 4. Публичный API
    // ============================================================

    /**
     * Возвращает URL головы (синхронно).
     * Если локальный скин уже загружен — вернёт его dataURL.
     * Иначе — SVG fallback (не внешний сервис!).
     *
     * Важно: не используем mc-heads/crafatar вообще — для пираток
     * они возвращают «Steve по умолчанию», все игроки одинаковые.
     */
    function getAvatar(name, size) {
        if (!name) name = '?';

        // Локальный скин загружен?
        var local = localCache.get(name);
        if (local && local !== 'fail') return local;

        // Пробуем загрузить локальный асинхронно
        if (local === undefined) {
            loadLocalSkin(name).then(function (result) {
                if (result === 'fail') return;
                // Обновляем все <img> с этим ником
                var imgs = document.querySelectorAll('img[data-pname="' + cssEscape(name) + '"]');
                for (var i = 0; i < imgs.length; i++) {
                    imgs[i].src = result;
                    imgs[i].dataset.avatarOk = '1';
                }
            });
        }

        // Fallback — SVG
        return makeSvgAvatar(name, size || 64);
    }

    /**
     * Замена битых картинок на SVG-аватар.
     * Слушает 'error' на img (capture, потому что error не всплывает).
     */
    function installErrorHandler() {
        document.body.addEventListener('error', function (e) {
            var el = e.target;
            if (!el || el.tagName !== 'IMG') return;
            if (el.dataset.avatarFixed === '1') return;
            var name = el.dataset.pname;
            if (!name) return;
            el.dataset.avatarFixed = '1';
            el.src = makeSvgAvatar(name, 64);
        }, true);
    }

    /**
     * Обработка всех уже присутствующих <img data-pname>.
     * Полезно после рендера таблицы/карточек.
     */
    function processExisting() {
        var imgs = document.querySelectorAll('img[data-pname]');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            var name = img.dataset.pname;
            if (!name) continue;

            // Уже с локальным скином?
            var local = localCache.get(name);
            if (local && local !== 'fail') {
                if (img.src !== local) img.src = local;
                continue;
            }

            // Пробуем загрузить локальный скин
            if (local === undefined) {
                loadLocalSkin(name).then(function (result) {
                    if (result === 'fail') return;
                    var imgs2 = document.querySelectorAll('img[data-pname="' + cssEscape(name) + '"]');
                    for (var j = 0; j < imgs2.length; j++) {
                        imgs2[j].src = result;
                    }
                });
            }

            // Если картинка ещё с внешнего URL и её источник похож на mc-heads/crafatar —
            // сразу ставим SVG, чтобы не показывать «Steve по умолчанию».
            // Но оставляем шанс: если пользователь сам подгрузит локальный скин, dataURL заменит.
            if (local === 'fail') {
                if (!img.dataset.avatarFixed) {
                    img.dataset.avatarFixed = '1';
                    img.src = makeSvgAvatar(name, 64);
                }
            }
        }
    }

    function cssEscape(s) {
        return String(s).replace(/["\\]/g, '\\$&');
    }

    /** Обёртка для внешних вызовов из panel-detail.js */
    window.getHeadAvatar = getAvatar;

    // ============================================================
    // 5. Мутации DOM — новые карточки/строки
    // ============================================================
    function installObserver() {
        var mo = new MutationObserver(function (mutations) {
            var need = false;
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.addedNodes && m.addedNodes.length > 0) {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var node = m.addedNodes[j];
                        if (node.nodeType === 1) {
                            if (node.tagName === 'IMG' && node.dataset.pname) {
                                need = true;
                                break;
                            }
                            if (node.querySelector && node.querySelector('img[data-pname]')) {
                                need = true;
                                break;
                            }
                        }
                    }
                }
                if (need) break;
            }
            if (need) setTimeout(processExisting, 30);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================================
    // Boot
    // ============================================================
    function boot() {
        installErrorHandler();
        installObserver();

        // Несколько прогонов после загрузки — чтобы поймать все рендеры
        [100, 500, 1500, 3000].forEach(function (delay) {
            setTimeout(processExisting, delay);
        });

        console.log('[Avatars] v1.0 ready (SVG fallback + local skins)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelAvatars = {
        get: getAvatar,
        svg: makeSvgAvatar,
        refresh: processExisting
    };
})();
