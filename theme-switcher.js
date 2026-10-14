/* ============================================================
   SOVEREIGNTY PANEL · THEME-SWITCHER.JS v2.0
   ============================================================
   Переключатель светлой / тёмной / авто темы.
   v2.0: SVG-иконки вместо эмодзи (sun / moon / theme).
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'panel_theme';
    var html = document.documentElement;

    function detectAuto() {
        try {
            return window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light';
        } catch (e) {
            return 'light';
        }
    }

    function getStored() {
        try {
            var v = localStorage.getItem(STORAGE_KEY);
            if (v === 'light' || v === 'dark' || v === 'auto') return v;
            return 'auto';
        } catch (e) {
            return 'auto';
        }
    }

    function setStored(v) {
        try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    }

    function updateButton(mode, effective) {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;

        var iconName;
        var label;
        if (mode === 'auto') {
            iconName = 'theme';
            label = 'Тема: авто (' + (effective === 'dark' ? 'тёмная' : 'светлая') + ')';
        } else if (mode === 'dark') {
            iconName = 'moon';
            label = 'Тема: тёмная';
        } else {
            iconName = 'sun';
            label = 'Тема: светлая';
        }

        btn.innerHTML = '';
        if (window.PanelIcons && window.PanelIcons.element) {
            var svg = window.PanelIcons.element(iconName, 18);
            if (svg) btn.appendChild(svg);
        }

        btn.title = label + ' — клик для переключения';
        btn.setAttribute('aria-label', label);
    }

    function applyTheme(mode) {
        var effective = (mode === 'auto') ? detectAuto() : mode;
        html.setAttribute('data-theme', effective);
        html.setAttribute('data-theme-mode', mode);
        updateButton(mode, effective);
    }

    function cycle() {
        var cur = getStored();
        var next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
        setStored(next);
        applyTheme(next);

        var label = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' }[next] || next;
        if (typeof window.showToast === 'function') {
            window.showToast('Тема: ' + label);
        }
    }

    function boot() {
        // Небольшая задержка, чтобы panel-icons.js успел определить window.PanelIcons
        setTimeout(function () {
            applyTheme(getStored());
        }, 0);

        var btn = document.getElementById('theme-toggle');
        if (btn) btn.addEventListener('click', cycle);

        try {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var handler = function () {
                if (getStored() === 'auto') applyTheme('auto');
            };
            if (mq.addEventListener) mq.addEventListener('change', handler);
            else if (mq.addListener) mq.addListener(handler);
        } catch (e) {}

        console.log('[ThemeSwitcher] v2.0 ready, mode=' + getStored());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.ThemeSwitcher = {
        get: getStored,
        set: function (mode) { setStored(mode); applyTheme(mode); },
        cycle: cycle
    };
})();
