/* ============================================================
   SOVEREIGNTY PANEL · THEME-SWITCHER.JS v1.0
   ============================================================
   Переключатель светлой / тёмной / авто темы.

   КАК РАБОТАЕТ:
     1. В <head> стоит маленький inline-скрипт, который применяет
        тему СРАЗУ при загрузке (чтобы не было "вспышки" светлой темы).
     2. Этот модуль вешает обработчик клика на кнопку #theme-toggle
        и переключает режимы: auto → light → dark → auto.
     3. Выбор хранится в localStorage под ключом panel_theme.
     4. В режиме auto мы следим за prefers-color-scheme и мгновенно
        переключаемся, если пользователь сменил тему ОС.

   ПОДКЛЮЧЕНИЕ: последним <script> в index.html.
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'panel_theme';
    var html = document.documentElement;

    // ============================================================
    // 1. Утилиты
    // ============================================================
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

    // ============================================================
    // 2. Применение темы
    // ============================================================
    function applyTheme(mode) {
        var effective = (mode === 'auto') ? detectAuto() : mode;
        html.setAttribute('data-theme', effective);
        html.setAttribute('data-theme-mode', mode);
        updateButton(mode, effective);
    }

    function updateButton(mode, effective) {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;

        var icon, title;
        if (mode === 'auto') {
            icon = (effective === 'dark') ? '🌗' : '🌓';
            title = 'Тема: авто (' +
                (effective === 'dark' ? 'тёмная' : 'светлая') + ')';
        } else if (mode === 'dark') {
            icon = '🌙';
            title = 'Тема: тёмная';
        } else {
            icon = '☀️';
            title = 'Тема: светлая';
        }

        btn.textContent = icon;
        btn.title = title + ' — клик для переключения';
        btn.setAttribute('aria-label', title);
    }

    // ============================================================
    // 3. Клик по кнопке
    // ============================================================
    function cycle() {
        var cur = getStored();
        var next;
        // auto → light → dark → auto
        if (cur === 'auto') next = 'light';
        else if (cur === 'light') next = 'dark';
        else next = 'auto';

        setStored(next);
        applyTheme(next);

        var label = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' }[next] || next;
        if (typeof window.showToast === 'function') {
            window.showToast('🎨 Тема: ' + label);
        }
    }

    // ============================================================
    // 4. Boot
    // ============================================================
    function boot() {
        applyTheme(getStored());

        var btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.addEventListener('click', cycle);
        }

        // Следим за prefers-color-scheme: если режим auto —
        // мгновенно реагируем на смену темы ОС.
        try {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var handler = function () {
                if (getStored() === 'auto') applyTheme('auto');
            };
            if (mq.addEventListener) mq.addEventListener('change', handler);
            else if (mq.addListener) mq.addListener(handler);
        } catch (e) {}

        console.log('[ThemeSwitcher] v1.0 ready, mode=' + getStored() +
            ', effective=' + html.getAttribute('data-theme'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Публичный API — на случай, если кто-то захочет переключать вручную.
    window.ThemeSwitcher = {
        get: getStored,
        set: function (mode) {
            setStored(mode);
            applyTheme(mode);
        },
        cycle: cycle
    };
})();
