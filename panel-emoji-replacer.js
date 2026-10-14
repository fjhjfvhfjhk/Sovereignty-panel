/* ============================================================
   SOVEREIGNTY PANEL · PANEL-EMOJI-REPLACER.JS v2.1
   ============================================================
   v2.1 (14.10.2026):
     - Добавлены эмодзи: 🚫 🎯 🪟 📝 👁️ 🎬 ⚠️ 💡.
     - Убран skip для .event-log-icon и .pp-chr-icon — теперь
       иконки в ленте событий и хрониках паспорта тоже
       становятся SVG.
     - Увеличен размер иконок в заголовках до 1.15em.

   v2.0: расширенная карта 70+ эмодзи.
   ============================================================ */
(function () {
    'use strict';

    var MAP = {
        /* Навигация */
        '\uD83C\uDFE0': 'home',           /* 🏠 */
        '\uD83D\uDDFA\uFE0F': 'map',      /* 🗺️ */
        '\uD83D\uDDFA': 'map',
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
        '\uD83C\uDFAF': 'target',         /* 🎯 (v2.1) */
        '\uD83D\uDCA1': 'bulb',           /* 💡 (v2.1) */
        '\uD83D\uDC41\uFE0F': 'eye',      /* 👁️ (v2.1) */
        '\uD83D\uDC41': 'eye',            /* 👁 (v2.1) */
        '\uD83D\uDCDD': 'memo',           /* 📝 (v2.1) */
        '\uD83E\uDE9F': 'window',         /* 🪟 (v2.1) */

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
        '\uD83C\uDFAC': 'movie',          /* 🎬 (v2.1) */

        /* Учёба / технологии */
        '\uD83D\uDD2C': 'microscope',     /* 🔬 */
        '\uD83C\uDFD7\uFE0F': 'construction', /* 🏗️ */
        '\uD83C\uDFD7': 'construction',

        /* Магазин */
        '\uD83C\uDFEA': 'shop',           /* 🏪 */
        '\uD83D\uDED2': 'cart',           /* 🛒 */

        /* Предупреждения / запреты */
        '\uD83D\uDEAB': 'ban',            /* 🚫 (v2.1) */
        '\u26A0\uFE0F': 'warning',        /* ⚠️ (v2.1) */
        '\u26A0': 'warning',              /* ⚠ (v2.1) */

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

        /* Замки */
        '\uD83D\uDD12': 'key',            /* 🔒 */
        '\uD83D\uDD13': 'key'             /* 🔓 */
    };

    var KEYS = Object.keys(MAP).sort(function (a, b) {
        return b.length - a.length;
    });

    /* --------------------------------------------------------
       Что НЕ трогаем.
       Убрали .event-log-icon и .pp-chr-icon — теперь в них
       тоже генерим SVG.
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
        '.event-log-msg',      /* текст сообщений — не портим */
        '.pp-chr-msg',
        '.panel-icon',
        '[data-icon]',
        '[data-icon-done]'
    ].join(',');

    function isSkipped(el) {
        if (!el || !el.closest) return false;
        return !!el.closest(SKIP_SELECTOR);
    }

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

    function buildEmojiIcon(iconName) {
        if (!window.PanelIcons || !window.PanelIcons.element) return null;
        var svg = window.PanelIcons.element(iconName, 16);
        if (!svg) return null;
        svg.classList.remove('panel-icon');
        svg.classList.add('emoji-icon');
        return svg;
    }

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
        } catch (e) {}
    }

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

    function boot() {
        walk(document.body);
        installObserver();

        [300, 800, 1500, 3000, 6000].forEach(function (delay) {
            setTimeout(function () { walk(document.body); }, delay);
        });

        console.log('[EmojiReplacer] v2.1 ready (' + KEYS.length + ' emoji mapped)');
    }

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
