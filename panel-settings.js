/* ============================================================
   SOVEREIGNTY PANEL · PANEL-SETTINGS.JS v1.1
   ============================================================
   v1.1 (07.11.2026):
     - Кнопка закрытия модалки: SVG-крестик через data-icon="close"
       вместо текстового ✕ (U+2715).
     - autoReplace() при создании модалки.
   ============================================================ */
(function () {
    'use strict';

    var KEY_ANIM = 'panel_animations';
    var KEY_HAP = 'panel_haptics';
    var KEY_PTR = 'panel_pull_refresh';
    var MODAL_ID = 'panel-settings-modal';

    var T = {
        title:      'Настройки',
        close:      'Закрыть',
        haptics:    'Вибрация',
        hapticsD:   'Отклик при касании (мобильные)',
        ptr:        'Pull-to-refresh',
        ptrD:       'Обновление свайпом вниз',
        anim:       'Анимации',
        animD:      'Фоновые эффекты и переходы',
        theme:      'Тема',
        themeAuto:  'Авто',
        themeL:     'Светлая',
        themeD:     'Тёмная',
        reset:      'Сбросить всё',
        resetArm:   'Точно?',
        okReset:    'Настройки сброшены',
        okTheme:    'Тема изменена'
    };

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function getBool(key, def) {
        try {
            var v = localStorage.getItem(key);
            if (v === null) return def;
            return v !== '0';
        } catch (e) { return def; }
    }
    function setBool(key, val) {
        try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) {}
    }
    function toast(msg) {
        if (typeof window.showToast === 'function') window.showToast(msg);
    }
    function applyAnimations(enabled) {
        var root = document.documentElement;
        if (enabled) root.classList.remove('no-animations');
        else root.classList.add('no-animations');
    }
    function autoReplace(root) {
        if (root && window.PanelIcons && window.PanelIcons.autoReplace) {
            window.PanelIcons.autoReplace(root);
        }
    }

    function buildToggleRow(label, desc, initial, onChange) {
        var row = el('div', 'ps-row');
        var left = el('div', 'ps-row-left');
        left.appendChild(el('div', 'ps-row-title', label));
        left.appendChild(el('div', 'ps-row-desc', desc));
        row.appendChild(left);
        var btn = el('button', 'ps-toggle' + (initial ? ' on' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-label', label);
        btn.appendChild(el('span', 'ps-toggle-knob'));
        btn.addEventListener('click', function () {
            var newVal = !btn.classList.contains('on');
            btn.classList.toggle('on', newVal);
            onChange(newVal);
        });
        row.appendChild(btn);
        return row;
    }

    function buildThemeRow() {
        var row = el('div', 'ps-row');
        var left = el('div', 'ps-row-left');
        left.appendChild(el('div', 'ps-row-title', T.theme));
        row.appendChild(left);

        var current = 'auto';
        if (window.ThemeSwitcher && typeof window.ThemeSwitcher.get === 'function') {
            current = window.ThemeSwitcher.get();
        }
        var seg = el('div', 'ps-seg');
        var modes = [
            { key: 'auto',  label: T.themeAuto },
            { key: 'light', label: T.themeL },
            { key: 'dark',  label: T.themeD }
        ];
        modes.forEach(function (m) {
            var b = el('button', 'ps-seg-btn' + (m.key === current ? ' active' : ''), m.label);
            b.type = 'button';
            b.addEventListener('click', function () {
                var all = seg.querySelectorAll('.ps-seg-btn');
                for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
                b.classList.add('active');
                if (window.ThemeSwitcher && typeof window.ThemeSwitcher.set === 'function') {
                    window.ThemeSwitcher.set(m.key);
                }
                toast(T.okTheme);
            });
            seg.appendChild(b);
        });
        row.appendChild(seg);
        return row;
    }

    function buildResetRow() {
        var row = el('div', 'ps-footer');
        var btn = el('button', 'ps-reset', T.reset);
        btn.type = 'button';
        var armed = false;
        var timer = null;
        function disarm() {
            armed = false;
            btn.textContent = T.reset;
            btn.classList.remove('armed');
            if (timer) { clearTimeout(timer); timer = null; }
        }
        btn.addEventListener('click', function () {
            if (!armed) {
                armed = true;
                btn.textContent = T.resetArm;
                btn.classList.add('armed');
                timer = setTimeout(disarm, 4000);
                return;
            }
            try {
                localStorage.removeItem(KEY_ANIM);
                localStorage.removeItem(KEY_HAP);
                localStorage.removeItem(KEY_PTR);
                if (window.ThemeSwitcher && typeof window.ThemeSwitcher.set === 'function') {
                    window.ThemeSwitcher.set('auto');
                }
            } catch (e) {}
            applyAnimations(true);
            disarm();
            var m = document.getElementById(MODAL_ID);
            if (m && m.parentNode) m.parentNode.removeChild(m);
            openModal();
            toast(T.okReset);
        });
        row.appendChild(btn);
        return row;
    }

    function buildModal() {
        var m = el('div', 'ps-modal');
        m.id = MODAL_ID;
        var ov = el('div', 'ps-overlay');
        ov.addEventListener('click', closeModal);
        var content = el('div', 'ps-content');

        var header = el('div', 'ps-header');
        header.appendChild(el('h2', 'ps-title', T.title));

        /* v1.1: SVG-крестик через data-icon */
        var closeBtn = el('button', 'ps-close');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', T.close);
        closeBtn.setAttribute('data-icon', 'close');
        closeBtn.setAttribute('data-icon-size', '16');
        closeBtn.addEventListener('click', closeModal);
        header.appendChild(closeBtn);
        content.appendChild(header);

        var rows = el('div', 'ps-rows');
        rows.appendChild(buildToggleRow(T.haptics, T.hapticsD, getBool(KEY_HAP, true),
            function (v) { setBool(KEY_HAP, v); }));
        rows.appendChild(buildToggleRow(T.ptr, T.ptrD, getBool(KEY_PTR, true),
            function (v) { setBool(KEY_PTR, v); }));
        rows.appendChild(buildToggleRow(T.anim, T.animD, getBool(KEY_ANIM, true),
            function (v) { setBool(KEY_ANIM, v); applyAnimations(v); }));
        rows.appendChild(buildThemeRow());
        content.appendChild(rows);
        content.appendChild(buildResetRow());

        m.appendChild(ov);
        m.appendChild(content);
        return m;
    }

    function ensureModal() {
        var m = document.getElementById(MODAL_ID);
        if (m) return m;
        m = buildModal();
        document.body.appendChild(m);
        autoReplace(m);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && m.classList.contains('show')) closeModal();
        });
        return m;
    }

    function openModal() {
        ensureModal();
        var m = document.getElementById(MODAL_ID);
        if (m) {
            m.classList.add('show');
            autoReplace(m);
        }
    }

    function closeModal() {
        var m = document.getElementById(MODAL_ID);
        if (m) m.classList.remove('show');
    }

    function installGearButton() {
        var btn = document.getElementById('panel-settings-btn');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    }

    function boot() {
        applyAnimations(getBool(KEY_ANIM, true));
        installGearButton();
        console.log('[PanelSettings] v1.1 ready (SVG close)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelSettings = {
        open: openModal,
        close: closeModal
    };
})();
