/* ============================================================
   SOVEREIGNTY PANEL · COUNTRY-COMPARE.JS v1.1
   ============================================================
   v1.1 (14.10.2026):
     - Кнопка "Сравнить" в паспорте — SVG-иконка scales вместо ⚖.
     - Кнопки в футере: SVG вместо 🔄 и 🔗.

   v1.0: сравнение двух стран side-by-side.
   ============================================================ */
(function () {
    'use strict';

    var PICKER_MODAL_ID = 'cmp-picker-modal';
    var COMPARE_MODAL_ID = 'cmp-compare-modal';

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }
    function escapeAttr(s) {
        return s == null ? '' : String(s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function formatMoney(a) {
        if (a == null) return '0';
        var abs = Math.abs(a);
        if (abs >= 1000000) return (a / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (a / 1000).toFixed(1) + 'k';
        return Math.round(a).toString();
    }

    /* Хелпер: создать кнопку с SVG-иконкой и текстом */
    function btnWithIcon(iconName, text, className, attrs) {
        var b = document.createElement('button');
        b.className = className || 'map-btn';
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                b.setAttribute(k, attrs[k]);
            });
        }
        if (window.PanelIcons && window.PanelIcons.element) {
            var svg = window.PanelIcons.element(iconName, 16);
            if (svg) b.appendChild(svg);
        }
        b.appendChild(document.createTextNode(' ' + text));
        return b;
    }

    // ============================================================
    // 1. Селектор второй страны
    // ============================================================
    function openPicker(firstCountryName) {
        var data = window.currentData;
        if (!data || !data.countries) return;

        var others = data.countries.filter(function (c) {
            return c.name !== firstCountryName;
        });
        if (others.length === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('Нет других стран для сравнения');
            }
            return;
        }

        others.sort(function (a, b) { return (b.claims || 0) - (a.claims || 0); });

        var picker = ensurePickerModal();
        document.getElementById('cmp-picker-body').innerHTML =
            '<h3 class="cmp-title">Сравнить с другой страной</h3>' +
            '<div class="cmp-subtitle">Выберите страну для сравнения с «' +
                escapeHtml(firstCountryName) + '»</div>' +
            '<div class="cmp-picker-list">' +
                others.map(function (c) {
                    return '<div class="cmp-picker-item" data-name="' + escapeAttr(c.name) + '">' +
                        '<span class="cmp-dot" style="background:' + escapeAttr(c.color || '#6366f1') + ';"></span>' +
                        '<span class="cmp-picker-name">' + escapeHtml(c.name) + '</span>' +
                    '</div>';
                }).join('') +
            '</div>';

        picker.dataset.first = firstCountryName;
        picker.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function ensurePickerModal() {
        var m = document.getElementById(PICKER_MODAL_ID);
        if (m) return m;
        m = document.createElement('div');
        m.id = PICKER_MODAL_ID;
        m.className = 'modal cmp-modal';
        m.innerHTML =
            '<div class="modal-overlay" data-cmp-picker-close></div>' +
            '<div class="modal-content cmp-modal-content">' +
                '<button class="modal-close" data-cmp-picker-close aria-label="Закрыть">✕</button>' +
                '<div id="cmp-picker-body"></div>' +
            '</div>';
        document.body.appendChild(m);

        m.querySelectorAll('[data-cmp-picker-close]').forEach(function (el) {
            el.addEventListener('click', function () {
                m.classList.remove('show');
                document.body.style.overflow = '';
            });
        });

        m.addEventListener('click', function (e) {
            var item = e.target.closest('.cmp-picker-item');
            if (!item) return;
            var second = item.dataset.name;
            var first = m.dataset.first;
            m.classList.remove('show');
            setTimeout(function () {
                openCompare(first, second);
            }, 80);
        });

        return m;
    }

    // ============================================================
    // 2. Модалка сравнения
    // ============================================================
    function openCompare(nameA, nameB) {
        var data = window.currentData;
        if (!data || !data.countries) return;
        var a = data.countries.filter(function (c) { return c.name === nameA; })[0];
        var b = data.countries.filter(function (c) { return c.name === nameB; })[0];
        if (!a || !b) {
            if (typeof window.showToast === 'function') window.showToast('Страна не найдена');
            return;
        }

        var m = ensureCompareModal();
        var body = document.getElementById('cmp-body');
        body.innerHTML = buildCompareHTML(a, b);
        m.classList.add('show');
        document.body.style.overflow = 'hidden';

        /* Рендерим SVG в кнопки футера */
        if (window.PanelIcons && window.PanelIcons.autoReplace) {
            window.PanelIcons.autoReplace(body);
        }
    }

    function ensureCompareModal() {
        var m = document.getElementById(COMPARE_MODAL_ID);
        if (m) return m;
        m = document.createElement('div');
        m.id = COMPARE_MODAL_ID;
        m.className = 'modal cmp-modal';
        m.innerHTML =
            '<div class="modal-overlay" data-cmp-close></div>' +
            '<div class="modal-content cmp-modal-content">' +
                '<button class="modal-close" data-cmp-close aria-label="Закрыть">✕</button>' +
                '<div id="cmp-body"></div>' +
            '</div>';
        document.body.appendChild(m);

        m.querySelectorAll('[data-cmp-close]').forEach(function (el) {
            el.addEventListener('click', function () {
                m.classList.remove('show');
                document.body.style.overflow = '';
            });
        });

        m.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-cmp-act]');
            if (!btn) return;
            var act = btn.dataset.cmpAct;
            var firstName = m.dataset.first;
            var secondName = m.dataset.second;
            if (act === 'swap') {
                openCompare(secondName, firstName);
            } else if (act === 'passport-a') {
                m.classList.remove('show');
                if (typeof window.openCountryPassport === 'function') {
                    setTimeout(function () { window.openCountryPassport(firstName); }, 80);
                }
            } else if (act === 'passport-b') {
                m.classList.remove('show');
                if (typeof window.openCountryPassport === 'function') {
                    setTimeout(function () { window.openCountryPassport(secondName); }, 80);
                }
            } else if (act === 'link') {
                var url = location.origin + location.pathname +
                    '?compare=' + encodeURIComponent(firstName) + ',' + encodeURIComponent(secondName);
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(url).then(function () {
                        if (typeof window.showToast === 'function') window.showToast('Ссылка скопирована');
                    });
                }
            }
        });

        return m;
    }

    // ============================================================
    // 3. Разметка сравнения
    // ============================================================
    function buildCompareHTML(a, b) {
        var m = document.getElementById(COMPARE_MODAL_ID);
        m.dataset.first = a.name;
        m.dataset.second = b.name;

        return '<h3 class="cmp-title">' + escapeHtml(a.name) + ' × ' + escapeHtml(b.name) + '</h3>' +
            '<div class="cmp-subtitle">Сравнение по ключевым метрикам</div>' +
            '<div class="cmp-table">' +
                metricRow('Чанков',
                    a.claims || 0, b.claims || 0,
                    (a.claims || 0) + ' / ' + (a.max_claims || '?'),
                    (b.claims || 0) + ' / ' + (b.max_claims || '?'),
                    'num') +
                metricRow('Казна',
                    a.bank || 0, b.bank || 0,
                    formatMoney(a.bank || 0),
                    formatMoney(b.bank || 0),
                    'num', 'money') +
                metricRow('Долг',
                    a.debt || 0, b.debt || 0,
                    formatMoney(a.debt || 0),
                    formatMoney(b.debt || 0),
                    'num', 'inverse') +
                metricRow('Энергия',
                    a.energy || 0, b.energy || 0,
                    (a.energy || 0).toFixed(1) + ' / ' + (a.max_energy || 0).toFixed(1),
                    (b.energy || 0).toFixed(1) + ' / ' + (b.max_energy || 0).toFixed(1),
                    'num') +
                metricRow('Регенерация',
                    a.regen || 0, b.regen || 0,
                    (a.regen || 0).toFixed(1) + '/ч',
                    (b.regen || 0).toFixed(1) + '/ч',
                    'num') +
                metricRow('Рост 7д',
                    a.claims_delta_7d || 0, b.claims_delta_7d || 0,
                    (a.claims_delta_7d > 0 ? '+' : '') + (a.claims_delta_7d || 0),
                    (b.claims_delta_7d > 0 ? '+' : '') + (b.claims_delta_7d || 0),
                    'num') +
                metricRow('Альянсы',
                    a.allies || 0, b.allies || 0,
                    String(a.allies || 0), String(b.allies || 0),
                    'num') +
                metricRow('Пакты',
                    a.pacts || 0, b.pacts || 0,
                    String(a.pacts || 0), String(b.pacts || 0),
                    'num') +
                metricRow('Активных войн',
                    a.active_wars || 0, b.active_wars || 0,
                    String(a.active_wars || 0), String(b.active_wars || 0),
                    'num', 'inverse') +
                metricRow('Фермы',
                    a.chunks_farm || 0, b.chunks_farm || 0,
                    String(a.chunks_farm || 0), String(b.chunks_farm || 0),
                    'num') +
                metricRow('Шахты',
                    a.chunks_mining || 0, b.chunks_mining || 0,
                    String(a.chunks_mining || 0), String(b.chunks_mining || 0),
                    'num') +
                metricRow('Военные чанки',
                    a.chunks_military || 0, b.chunks_military || 0,
                    String(a.chunks_military || 0), String(b.chunks_military || 0),
                    'num') +
                metricRow('Торговые чанки',
                    a.chunks_trade || 0, b.chunks_trade || 0,
                    String(a.chunks_trade || 0), String(b.chunks_trade || 0),
                    'num')
            + '</div>' +
            '<div class="cmp-footer">' +
                '<button class="map-btn" data-cmp-act="passport-a" data-icon="book" data-icon-size="16">Паспорт ' +
                    escapeHtml(a.name) + '</button>' +
                '<button class="map-btn" data-cmp-act="passport-b" data-icon="book" data-icon-size="16">Паспорт ' +
                    escapeHtml(b.name) + '</button>' +
                '<button class="map-btn" data-cmp-act="swap" data-icon="refresh" data-icon-size="16">Поменять местами</button>' +
                '<button class="map-btn" data-cmp-act="link" data-icon="scroll" data-icon-size="16">Скопировать ссылку</button>' +
            '</div>';
    }

    function metricRow(label, valA, valB, dispA, dispB, type, inverse) {
        var aBetter = false, bBetter = false;
        if (valA !== valB) {
            if (inverse === 'inverse') {
                aBetter = valA < valB;
                bBetter = valB < valA;
            } else {
                aBetter = valA > valB;
                bBetter = valB > valA;
            }
        }

        var clsA = aBetter ? 'better' : (bBetter ? 'worse' : '');
        var clsB = bBetter ? 'better' : (aBetter ? 'worse' : '');
        var money = type === 'money' ? ' money' : '';

        return '<div class="cmp-cell left ' + clsA + '">' +
                    '<b class="' + money + '">' + dispA + '</b>' +
                    (aBetter ? '<span class="cmp-arrow left">◀</span>' : '') +
                '</div>' +
                '<div class="cmp-row-label">' + escapeHtml(label) + '</div>' +
                '<div class="cmp-cell ' + clsB + '">' +
                    '<b class="' + money + '">' + dispB + '</b>' +
                    (bBetter ? '<span class="cmp-arrow right">▶</span>' : '') +
                '</div>';
    }

    // ============================================================
    // 4. Кнопка в паспорте страны
    // ============================================================
    function installPassportButton() {
        var passportModal = document.getElementById('country-modal');
        if (!passportModal) return;

        var mo = new MutationObserver(function () {
            setTimeout(addCompareBtn, 50);
        });
        mo.observe(passportModal, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        setTimeout(addCompareBtn, 500);
    }

    function addCompareBtn() {
        var actions = document.querySelector('#country-modal .pp-actions');
        if (!actions) return;
        if (actions.querySelector('[data-pp-act="compare"]')) return;

        var btn = btnWithIcon('scales', 'Сравнить', 'map-btn pp-action-btn', {
            type: 'button',
            'data-pp-act': 'compare'
        });
        actions.appendChild(btn);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var m = document.getElementById('country-modal');
            var firstName = m ? m.dataset.country : null;
            if (!firstName) return;
            m.classList.remove('show');
            document.body.style.overflow = '';
            setTimeout(function () { openPicker(firstName); }, 100);
        });
    }

    // ============================================================
    // 5. URL deep-link ?compare=A,B
    // ============================================================
    function checkUrlCompare() {
        try {
            var params = new URLSearchParams(location.search);
            var c = params.get('compare');
            if (!c) return;
            var parts = c.split(',');
            if (parts.length !== 2) return;
            var tries = 0;
            var iv = setInterval(function () {
                tries++;
                if (window.currentData && window.currentData.countries
                        && window.currentData.countries.length > 0) {
                    clearInterval(iv);
                    openCompare(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
                } else if (tries > 30) {
                    clearInterval(iv);
                }
            }, 300);
        } catch (e) {}
    }

    // ============================================================
    // 6. Boot
    // ============================================================
    function boot() {
        ensurePickerModal();
        ensureCompareModal();
        installPassportButton();
        checkUrlCompare();
        console.log('[CountryCompare] v1.1 ready (SVG icons)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.openCountryCompare = openCompare;
    window.openComparePicker = openPicker;
})();
