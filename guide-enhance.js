/* ============================================================
   SOVEREIGNTY PANEL · GUIDE-ENHANCE.JS v1.2
   ============================================================
   Улучшения гайда:
     - Поиск по секциям (input в guide-nav).
     - Горизонтальный скролл навигации на мобилке.
     - Кнопка «Наверх» в правом углу.
     - Динамическая высота sticky-навигации (--guide-header-offset).

   ФИКС v1.2 (12.10.2026):
     1) На мобилке страница гайда уходила за правый край — нижний
        nav-bar уезжал. Причина: горизонтальный overflow от grid/flex
        элементов. CSS-фикс применён в guide-enhance.css (min-width:0
        + overflow-x:hidden), а JS теперь ещё измеряет высоту <header>
        и выставляет --guide-header-offset, чтобы sticky-nav стоял
        ровно под шапкой.
     2) ensureLayout() вызывается на каждое изменение nav (app.js:initGuideNav
        пересоздаёт ссылки — их надо возвращать в wrap).
   ============================================================ */
(function () {
    'use strict';

    var lastSearchQuery = '';
    var layoutScheduled = false;

    // ============================================================
    // 1. Утилиты
    // ============================================================
    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    // ============================================================
    // 2. Динамическая высота шапки
    // ============================================================
    function updateHeaderOffset() {
        try {
            var header = document.querySelector('header');
            if (!header) return;
            var h = header.getBoundingClientRect().height;
            if (h > 0) {
                document.documentElement.style.setProperty(
                    '--guide-header-offset',
                    Math.ceil(h) + 'px'
                );
            }
        } catch (e) {}
    }

    // ============================================================
    // 3. Layout — гарантированная структура nav
    // ============================================================
    function ensureLayout() {
        var nav = document.getElementById('guide-nav');
        if (!nav) return;

        // --- 3.1 Search-wrap всегда после title (или первым) ---
        var title = nav.querySelector('.guide-nav-title');
        var search = nav.querySelector('.guide-search-wrap');
        if (!search) {
            search = buildSearchWrap();
            if (title && title.parentNode === nav && title.nextSibling) {
                nav.insertBefore(search, title.nextSibling);
            } else if (title && title.parentNode === nav) {
                nav.appendChild(search);
            } else {
                nav.insertBefore(search, nav.firstChild);
            }
            bindSearch(search);
        } else if (title && title.nextSibling !== search) {
            nav.insertBefore(search, title.nextSibling);
        }

        // --- 3.2 Wrap существует ---
        var wrap = nav.querySelector('.guide-nav-links-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'guide-nav-links-wrap';
            nav.appendChild(wrap);
        }

        // --- 3.3 Все ПРЯМЫЕ дети-<a> переехали в wrap ---
        var directLinks = [];
        for (var i = 0; i < nav.children.length; i++) {
            var child = nav.children[i];
            if (child.tagName === 'A') directLinks.push(child);
        }
        if (directLinks.length > 0) {
            directLinks.forEach(function (a) { wrap.appendChild(a); });
        }

        // --- 3.4 Search должен быть ПЕРЕД wrap-ом ---
        if (search.nextSibling && search.nextSibling !== wrap) {
            nav.insertBefore(wrap, search.nextSibling);
        }

        // --- 3.5 Восстанавливаем поиск ---
        var input = nav.querySelector('#guide-search');
        if (input && !input.value && lastSearchQuery) {
            input.value = lastSearchQuery;
        }
    }

    function scheduleLayout() {
        if (layoutScheduled) return;
        layoutScheduled = true;
        requestAnimationFrame(function () {
            layoutScheduled = false;
            ensureLayout();
        });
    }

    // ============================================================
    // 4. Построение блока поиска
    // ============================================================
    function buildSearchWrap() {
        var wrap = document.createElement('div');
        wrap.className = 'guide-search-wrap';
        wrap.innerHTML =
            '<input type="search" class="guide-search" id="guide-search" ' +
                   'placeholder="🔍 Поиск по гайду..." autocomplete="off">' +
            '<button class="guide-search-clear" id="guide-search-clear" ' +
                    'type="button" aria-label="Очистить">✕</button>' +
            '<span class="guide-search-count" id="guide-search-count"></span>';
        return wrap;
    }

    function bindSearch(wrap) {
        var input = wrap.querySelector('#guide-search');
        var clear = wrap.querySelector('#guide-search-clear');
        if (!input) return;

        input.addEventListener('input', function () {
            var q = input.value.trim();
            lastSearchQuery = q;
            if (clear) clear.classList.toggle('visible', q.length > 0);
            applySearch(q);
        });

        if (clear) {
            clear.addEventListener('click', function () {
                input.value = '';
                lastSearchQuery = '';
                clear.classList.remove('visible');
                applySearch('');
                input.focus();
            });
        }
    }

    // ============================================================
    // 5. Поиск
    // ============================================================
    function applySearch(query) {
        var sections = document.querySelectorAll('#tab-guide .guide-section');
        var countEl = document.getElementById('guide-search-count');
        var q = query.toLowerCase();
        var visible = 0;
        var total = sections.length;

        sections.forEach(function (section) {
            if (!q) {
                section.classList.remove('guide-hidden');
                removeHits(section);
                visible++;
                return;
            }
            var text = (section.textContent || '').toLowerCase();
            var hit = text.indexOf(q) !== -1;
            if (hit) {
                section.classList.remove('guide-hidden');
                visible++;
                highlight(section, query);
            } else {
                section.classList.add('guide-hidden');
                removeHits(section);
            }
        });

        if (!countEl) return;
        if (!q) {
            countEl.textContent = '';
            countEl.classList.remove('no-results');
        } else {
            countEl.textContent = visible + '/' + total;
            countEl.classList.toggle('no-results', visible === 0);
        }
    }

    function highlight(section, query) {
        removeHits(section);
        if (!query || query.length < 2) return;
        var safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('(' + safeQuery + ')', 'gi');

        var walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var p = node.parentNode;
                if (!p) return NodeFilter.FILTER_REJECT;
                var tag = p.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) {
            re.lastIndex = 0;
            if (re.test(n.nodeValue)) nodes.push(n);
        }

        nodes.forEach(function (node) {
            var str = node.nodeValue;
            var frag = document.createDocumentFragment();
            var lastIdx = 0;
            var m;
            re.lastIndex = 0;
            while ((m = re.exec(str)) !== null) {
                if (m.index > lastIdx) {
                    frag.appendChild(document.createTextNode(str.substring(lastIdx, m.index)));
                }
                var mark = document.createElement('mark');
                mark.className = 'guide-hit';
                mark.textContent = m[0];
                frag.appendChild(mark);
                lastIdx = m.index + m[0].length;
            }
            if (lastIdx < str.length) {
                frag.appendChild(document.createTextNode(str.substring(lastIdx)));
            }
            if (node.parentNode) node.parentNode.replaceChild(frag, node);
        });
    }

    function removeHits(section) {
        var marks = section.querySelectorAll('mark.guide-hit');
        if (marks.length === 0) return;
        marks.forEach(function (m) {
            var parent = m.parentNode;
            if (!parent) return;
            parent.replaceChild(document.createTextNode(m.textContent), m);
            parent.normalize();
        });
    }

    // ============================================================
    // 6. Кнопка «Наверх»
    // ============================================================
    function installTopButton() {
        if (document.querySelector('.guide-top-btn')) return;
        var btn = document.createElement('button');
        btn.className = 'guide-top-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Наверх');
        btn.textContent = '↑';
        btn.addEventListener('click', function () {
            var nav = document.getElementById('guide-nav');
            if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.body.appendChild(btn);

        var check = function () {
            var tab = document.getElementById('tab-guide');
            var isActive = tab && tab.classList.contains('active');
            if (!isActive) {
                btn.classList.remove('visible');
                return;
            }
            if (window.scrollY > 400) btn.classList.add('visible');
            else btn.classList.remove('visible');
        };
        window.addEventListener('scroll', check, { passive: true });
        setInterval(check, 800);
    }

    // ============================================================
    // 7. Наблюдение
    // ============================================================
    function watchNav() {
        var nav = document.getElementById('guide-nav');
        if (!nav) return;
        var mo = new MutationObserver(function () { scheduleLayout(); });
        mo.observe(nav, { childList: true, subtree: false });
    }

    function watchGuide() {
        var content = document.getElementById('guide-content');
        if (!content) return;
        var mo = new MutationObserver(function () { scheduleLayout(); });
        mo.observe(content, { childList: true, subtree: false });
    }

    // ============================================================
    // 8. Boot
    // ============================================================
    function boot() {
        updateHeaderOffset();
        installTopButton();
        ensureLayout();
        watchNav();
        watchGuide();

        // Слушаем resize — высота шапки меняется при повороте экрана
        window.addEventListener('resize', function () {
            updateHeaderOffset();
        });

        // Ещё раз — если шрифты догрузились и шапка стала выше
        setTimeout(updateHeaderOffset, 800);
        setTimeout(updateHeaderOffset, 2000);

        // Регулярные ретраи на случай поздней загрузки guide.html
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            ensureLayout();
            if (tries > 40) clearInterval(iv);
        }, 400);

        setTimeout(function () { ensureLayout(); updateHeaderOffset(); }, 3000);
        setTimeout(function () { ensureLayout(); updateHeaderOffset(); }, 8000);

        var guideBtn = document.querySelector('.main-nav .nav-btn[data-tab="guide"]');
        if (guideBtn) {
            guideBtn.addEventListener('click', function () {
                setTimeout(function () {
                    ensureLayout();
                    updateHeaderOffset();
                }, 100);
                setTimeout(function () {
                    ensureLayout();
                    updateHeaderOffset();
                }, 500);
            });
        }

        console.log('[GuideEnhance] v1.2 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
