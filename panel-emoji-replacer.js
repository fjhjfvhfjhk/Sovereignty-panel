/* ============================================================
   SOVEREIGNTY PANEL · PANEL-EMOJI-REPLACER.JS v2.0
   ============================================================
   v2.0 (14.10.2026):
     - Расширенная карта: 70+ эмодзи → имена иконок PanelIcons.
     - Все эмодзи внутри обычного текста заменяются на inline SVG.
     - Размер SVG = 1em родителя (через CSS-класс .emoji-icon).
     - Пропускает контент, приходящий от сервера: event_log
       (icon + message), паспорт-хроники, гайд-заголовки — там
       эмодзи осмысленны и приходят из JSON.
     - Работает через MutationObserver на весь body.

   ЗАЧЕМ: чтобы НЕ править руками ни app.js, ни десяток других
   файлов, где в шаблонах ещё сидят эмодзи.

   ПОДКЛЮЧЕНИЕ: сразу после panel-icons.js.
     <script src="panel-icons.js"></script>
     <script src="panel-emoji-replacer.js"></script>
   ============================================================ */
(function () {
    'use strict';

    /* --------------------------------------------------------
       Карта эмодзи → имя иконки в PanelIcons.
       Ключи — эмодзи (в Unicode escape), значения — имена.
       Порядок в объекте не важен, но при поиске идём
       longest-first, чтобы составные эмодзи (с VS-16) ловились
       раньше коротких.
       -------------------------------------------------------- */
    var MAP = {
        /* Навигация */
        '\uD83C\uDFE0': 'home',           /* 🏠 */
        '\uD83D\uDDFA\uFE0F': 'map',      /* 🗺️ */
        '\uD83D\uDDFA': 'map',            /* 🗺 */
        '\uD83D\uDC65': 'users',          /* 👥 */
        '\uD83D\uDCDC': 'scroll',         /* 📜 */
        '\uD83D\uDCD6': 'book',           /* 📖 */
        '\uD83D\uDCD6\uFE0F': 'book',
        '\u2328\uFE0F': 'keyboard',       /* ⌨️ */
        '\u2328': 'keyboard',
        '\uD83C\uDF81': 'gift',           /* 🎁 */

        /* Системные */
        '\uD83C\uDF13': 'theme',          /* 🌓 */
        '\uD83C\uDF12': 'theme',          /* 🌒 */
        '\uD83C\uDF14': 'theme',          /* 🌔 */
        '\uD83C\uDF19': 'moon',           /* 🌙 */
        '\u2600\uFE0F': 'sun',            /* ☀️ */
        '\u2600': 'sun',
        '\uD83D\uDD50': 'clock',          /* 🕐 */
        '\uD83D\uDD52': 'clock',          /* 🕒 */
        '\uD83D\uDD04': 'refresh',        /* 🔄 */
        '\u2699\uFE0F': 'info',           /* ⚙️ */
        '\u2699': 'info',

        /* Метрики */
        '\uD83C\uDFDB\uFE0F': 'landmark', /* 🏛️ */
        '\uD83C\uDFDB': 'landmark',
        '\uD83C\uDFF0': 'castle',         /* 🏰 */
        '\uD83C\uDFE6': 'bank',           /* 🏦 */
        '\uD83D\uDCB0': 'money',          /* 💰 */
        '\uD83D\uDCB8': 'money-out',      /* 💸 */
        '\uD83D\uDCB5': 'money',          /* 💵 */
        '\u26A1': 'bolt',                 /* ⚡ */
        '\uD83D\uDCC8': 'chart',          /* 📈 */
        '\uD83D\uDCC9': 'chart-down',     /* 📉 */
        '\uD83D\uDCCA': 'chart',          /* 📊 */
        '\uD83C\uDFC6': 'trophy',         /* 🏆 */
        '\u2728': 'sparkles',             /* ✨ */
        '\uD83C\uDF31': 'sprout',         /* 🌱 */

        /* Действия */
        '\u2694\uFE0F': 'war',            /* ⚔️ */
        '\u2694': 'war',
        '\uD83E\uDD1D': 'handshake',      /* 🤝 */
        '\uD83D\uDC51': 'crown',          /* 👑 */
        '\u2693': 'anchor',               /* ⚓ */
        '\u2B50': 'star',                 /* ⭐ */
        '\uD83D\uDD25': 'flame',          /* 🔥 */
        '\u2744\uFE0F': 'snow',           /* ❄️ */
        '\u2744': 'snow',
        '\uD83C\uDF0A': 'wave',           /* 🌊 */
        '\uD83C\uDF32': 'tree',           /* 🌲 */
        '\uD83C\uDF35': 'cactus',         /* 🌵 */
        '\uD83C\uDF3E': 'wheat',          /* 🌾 */
        '\uD83D\uDDE1\uFE0F': 'sword',    /* 🗡️ */
        '\uD83D\uDDE1': 'sword',
        '\uD83D\uDEE1\uFE0F': 'shield',   /* 🛡️ */
        '\uD83D\uDEE1': 'shield',
        '\u271D\uFE0F': 'cross',          /* ✝️ */
        '\uD83D\uDD11': 'key',            /* 🔑 */
        '\uD83D\uDD28': 'hammer',         /* 🔨 */
        '\uD83C\uDF77': 'chalice',        /* 🍷 */
        '\u26CF\uFE0F': 'pickaxe',        /* ⛏️ */
        '\u26CF': 'pickaxe',
        '\uD83D\uDC8E': 'gem',            /* 💎 */
        '\uD83D\uDCE6': 'treasure',       /* 📦 */
        '\uD83C\uDFF9': 'hunt',           /* 🏹 */

        /* Люди */
        '\uD83D\uDC64': 'group',          /* 👤 */

        /* Дипломатия */
        '\u2696\uFE0F': 'scales',         /* ⚖️ */
        '\u2696': 'scales',
        '\uD83D\uDD4A\uFE0F': 'dove',     /* 🕊️ */
        '\uD83D\uDD4A': 'dove',
        '\uD83D\uDCAC': 'speech',         /* 💬 */
        '\uD83D\uDCCB': 'clipboard',      /* 📋 */

        /* Смерть / казино */
        '\uD83D\uDC80': 'skull',          /* 💀 */
        '\u2620\uFE0F': 'skull',          /* ☠️ */
        '\u2620': 'skull',
        '\uD83C\uDFB0': 'casino',         /* 🎰 */
        '\uD83C\uDFB2': 'casino',         /* 🎲 */

        /* Учёба / технологии */
        '\uD83D\uDD2C': 'microscope',     /* 🔬 */
        '\uD83C\uDFD7\uFE0F': 'construction', /* 🏗️ */
        '\uD83C\uDFD7': 'construction',

        /* Магазин */
        '\uD83C\uDFEA': 'shop',           /* 🏪 */
        '\uD83D\uDED2': 'cart',           /* 🛒 */

        /* Прочее */
        '\uD83C\uDFA8': 'palette',        /* 🎨 */
        '\uD83D\uDDBC\uFE0F': 'image',    /* 🖼️ */
        '\uD83D\uDDBC': 'image',
        '\uD83D\uDD0D': 'search',         /* 🔍 */
        '\u2139\uFE0F': 'info',           /* ℹ️ */
        '\u2139': 'info',
        '\u270F\uFE0F': 'pen',            /* ✏️ */
        '\u270F': 'pen',
        '\uD83D\uDDD1\uFE0F': 'trash',    /* 🗑️ */
        '\uD83D\uDDD1': 'trash',
        '\uD83D\uDEAA': 'logout',         /* 🚪 */
        '\uD83D\uDEA9': 'flag',           /* 🚩 */
        '\u231B': 'time',                 /* ⌛ */
        '\u23F3': 'time',                 /* ⏳ */
        '\uD83D\uDCCD': 'map-pin',        /* 📍 */
        '\uD83E\uDDED': 'compass',        /* 🧭 */
        '\uD83C\uDFD4\uFE0F': 'mountains',/* 🏔️ */
        '\uD83C\uDFD4': 'mountains',
        '\uD83D\uDCA5': 'boom',           /* 💥 */
        '\u2753': 'info',                 /* ❓ */
        '\u2757': 'info',                 /* ❗ */

        /* Стрелки и метки — оставим как текст, они не эмодзи */

        /* Замки */
        '\uD83D\uDD12': 'key',            /* 🔒 */
        '\uD83D\uDD13': 'key'             /* 🔓 */
    };

    /* Сортируем ключи longest-first для корректного greedy match */
    var KEYS = Object.keys(MAP).sort(function (a, b) {
        return b.length - a.length;
    });

    /* --------------------------------------------------------
       Селекторы контента, который НЕ трогаем.
       Там эмодзи либо осмысленны (приходят из JSON как иконка),
       либо это исходный текст, где замена сломает данные.
       -------------------------------------------------------- */
    var SKIP_SELECTOR = [
        'script',
        'style',
        'textarea',
        'input',
        'select',
        'option',
        'code',
        'pre',
        /* контент от сервера: */
        '.event-log-icon',
        '.event-log-msg',
        '.pp-chr-icon',
        '.pp-chr-msg',
        /* уже обработанное: */
        '.panel-icon',
        '[data-icon]',
        '[data-icon-done]'
    ].join(',');

    function isSkipped(el) {
        if (!el || !el.closest) return false;
        return !!el.closest(SKIP_SELECTOR);
    }

    /* --------------------------------------------------------
       Поиск всех эмодзи в строке — возвращает массив
       { index, len, emoji }
       -------------------------------------------------------- */
    function findEmojis(str) {
        var out = [];
        var i = 0;
        while (i < str.length) {
            var matched = null;
            for (var k = 0; k < KEYS.length; k++) {
                var em = KEYS[k];
                if (str.indexOf(em, i) === i) {
                    matched = em;
                    break;
                }
            }
            if (matched) {
                out.push({ index: i, len: matched.length, emoji: matched });
                i += matched.length;
            } else {
                i++;
            }
        }
        return out;
    }

    /* --------------------------------------------------------
       Построение inline-SVG для эмодзи.
       Размер 1em через CSS-класс .emoji-icon.
       -------------------------------------------------------- */
    function buildEmojiIcon(iconName) {
        if (!window.PanelIcons || !window.PanelIcons.element) return null;
        /* Базовый размер 16 задаём в SVG-атрибутах.
           CSS `.emoji-icon { width: 1em; height: 1em }` перебьёт его
           и сделает иконку по размеру текста родителя. */
        var svg = window.PanelIcons.element(iconName, 16);
        if (!svg) return null;
        svg.classList.remove('panel-icon');
        svg.classList.add('emoji-icon');
        return svg;
    }

    /* --------------------------------------------------------
       Замена в одном текстовом узле.
       -------------------------------------------------------- */
    function replaceTextNode(textNode) {
        var str = textNode.nodeValue;
        if (!str) return;

        var matches = findEmojis(str);
        if (matches.length === 0) return;

        var parent = textNode.parentNode;
        if (!parent || isSkipped(parent)) return;

        var frag = document.createDocumentFragment();
        var cursor = 0;
        var replaced = false;

        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            if (m.index > cursor) {
                frag.appendChild(document.createTextNode(
                    str.substring(cursor, m.index)));
            }
            var iconName = MAP[m.emoji];
            var svg = buildEmojiIcon(iconName);
            if (svg) {
                frag.appendChild(svg);
                replaced = true;
            } else {
                /* Не нашли иконку — оставляем эмодзи как есть */
                frag.appendChild(document.createTextNode(m.emoji));
            }
            cursor = m.index + m.len;
        }
        if (cursor < str.length) {
            frag.appendChild(document.createTextNode(str.substring(cursor)));
        }

        if (!replaced) return;

        try {
            parent.replaceChild(frag, textNode);
        } catch (e) {
            /* Нода могла исчезнуть — ок */
        }
    }

    /* --------------------------------------------------------
       Обход дерева и замена всех текстовых узлов.
       -------------------------------------------------------- */
    function walk(root) {
        if (!root || root.nodeType !== 1) return;
        if (isSkipped(root)) return;

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (isSkipped(node.parentNode)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        for (var i = 0; i < nodes.length; i++) replaceTextNode(nodes[i]);
    }

    /* --------------------------------------------------------
       Наблюдение за DOM — новые узлы тоже обрабатываем.
       -------------------------------------------------------- */
    function installObserver() {
        if (typeof MutationObserver === 'undefined') return;

        var scheduled = false;
        var mo = new MutationObserver(function (mutations) {
            if (scheduled) return;
            var hasNew = false;
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type !== 'childList') continue;
                if (m.addedNodes && m.addedNodes.length > 0) {
                    hasNew = true;
                    break;
                }
            }
            if (!hasNew) return;
            scheduled = true;
            setTimeout(function () {
                scheduled = false;
                walk(document.body);
            }, 40);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    /* --------------------------------------------------------
       Boot
       -------------------------------------------------------- */
    function boot() {
        walk(document.body);
        installObserver();

        /* Несколько повторных прогонов — на случай асинхронных рендеров */
        [300, 800, 1500, 3000, 6000].forEach(function (delay) {
            setTimeout(function () { walk(document.body); }, delay);
        });

        console.log('[EmojiReplacer] v2.0 ready (' + KEYS.length + ' emoji mapped)');
    }

    /* Ждём PanelIcons — он нужен для генерации SVG */
    function waitForIconsAndBoot() {
        if (window.PanelIcons && window.PanelIcons.element) {
            boot();
        } else {
            setTimeout(waitForIconsAndBoot, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForIconsAndBoot);
    } else {
        waitForIconsAndBoot();
    }

    window.PanelEmojiReplacer = {
        refresh: function () { walk(document.body); },
        map: MAP
    };
})();
