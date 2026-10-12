/* ============================================================
   SOVEREIGNTY PANEL · GUIDE-ENHANCE.JS v1.0
   ============================================================
   Улучшения гайда:
     - Поиск по секциям (input в guide-nav).
     - Обёртка ссылок навигации для sticky-навигации на мобилке.
     - Кнопка «Наверх» в правом углу.

   ПОДКЛЮЧЕНИЕ: последним <script> в index.html.
   ============================================================ */
(function () {
    'use strict';

    var lastSearchQuery = '';

    // ============================================================
    // 1. Обёртка навигационных ссылок
    // ============================================================
    function wrapNavLinks() {
        var nav = document.getElementById('guide-nav');
        if (!nav) return false;
        if (nav.querySelector('.guide-nav-links-wrap')) return true;

        var links = Array.from(nav.querySelectorAll('a'));
        if (links.length === 0) return false;

        var wrap = document.createElement('div');
        wrap.className = 'guide-nav-links-wrap';
        links.forEach(function (a) { wrap.appendChild(a); });
        nav.appendChild(wrap);
        return true;
    }

    // ============================================================
    // 2. Поиск по гайду
    // ============================================================
    function installSearch() {
        var nav = document.getElementById('guide-nav');
        if (!nav) return;
        if (nav.querySelector('.guide-search-wrap')) return;

        var wrap = document.createElement('div');
        wrap.className = 'guide-search-wrap';
        wrap.innerHTML =
            '<input type="search" class="guide-search" id="guide-search" ' +
                   'placeholder="🔍 Поиск по гайду..." autocomplete="off">' +
            '<button class="guide-search-clear" id="guide-search-clear" ' +
                    'type="button" aria-label="Очистить">✕</button>' +
            '<span class="guide-search-count" id="guide-search-count"></span>';

        nav.insertBefore(wrap, nav.firstChild);

        var input = document.getElementById('guide-search');
        var clear = document.getElementById('guide-search-clear');
        var count = document.getElementById('guide-search-count');

        input.addEventListener('input', function () {
            var q = input.value.trim();
            lastSearchQuery = q;
            clear.classList.toggle('visible', q.length > 0);
            applySearch(q);
        });

        clear.addEventListener('click', function () {
            input.value = '';
            lastSearchQuery = '';
            clear.classList.remove('visible');
            applySearch('');
            input.focus();
        });

        // Восстановить, если был активный поиск
        if (lastSearchQuery) {
            input.value = lastSearchQuery;
            clear.classList.toggle('visible', true);
            applySearch(lastSearchQuery);
        }
    }

    // ============================================================
    // 3. Применение поиска
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
                // Убрать подсветку
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

    // ============================================================
    // 4. Подсветка совпадений
    // ============================================================
    function highlight(section, query) {
        removeHits(section);
        if (!query || query.length < 2) return;
        // Простая подсветка через innerHTML: используем regex-экранирование
        var safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('(' + safeQuery + ')', 'gi');
        // Итерируем по текстовым узлам, оборачиваем совпадения в <mark>
        var walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (node.parentNode.tagName === 'SCRIPT' || node.parentNode.tagName === 'STYLE') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) {
            if (re.test(n.nodeValue)) {
                nodes.push(n);
                re.lastIndex = 0;
            }
        }
        nodes.forEach(function (node) {
            var frag = document.createDocumentFragment();
            var str = node.nodeValue;
            var lastIdx = 0;
            re.lastIndex = 0;
            var m;
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
            node.parentNode.replaceChild(frag, node);
        });
    }

    function removeHits(section) {
        section.querySelectorAll('mark.guide-hit').forEach(function (m) {
            var parent = m.parentNode;
            parent.replaceChild(document.createTextNode(m.textContent), m);
            parent.normalize();
        });
    }

    // ============================================================
    // 5. Кнопка «Наверх»
    // ============================================================
    function installTopButton() {
        if (document.querySelector('.guide-top-btn')) return;
        var btn = document.createElement('button');
        btn.className = 'guide-top-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Наверх');
        btn.textContent = '↑';
        btn.addEventListener('click', function () {
            var tab = document.getElementById('tab-guide');
            if (tab && tab.classList.contains('active')) {
                var nav = document.getElementById('guide-nav');
                if (nav) {
                    nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });
        document.body.appendChild(btn);

        // Показ по скроллу
        var check = function () {
            var tab = document.getElementById('tab-guide');
            var isGuideActive = tab && tab.classList.contains('active');
            if (!isGuideActive) {
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
    // 6. Наблюдение за загрузкой гайда
    // ============================================================
    function watchGuide() {
        var content = document.getElementById('guide-content');
        if (!content) return;

        var mo = new MutationObserver(function () {
            setTimeout(tryEnhance, 50);
        });
        mo.observe(content, { childList: true, subtree: false });

        // Плюс периодический ретрай — на случай, если observer не поймает
        // момент, когда initGuideNav() в app.js построит ссылки.
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            tryEnhance();
            if (tries > 20) clearInterval(iv);
        }, 300);
    }

    function tryEnhance() {
        // Ждём, пока появится хотя бы одна ссылка в навигации
        var nav = document.getElementById('guide-nav');
        if (!nav) return;
        var hasLinks = nav.querySelectorAll('a').length > 0;
        if (!hasLinks) return;

        wrapNavLinks();
        installSearch();
    }

    // ============================================================
    // 7. Boot
    // ============================================================
    function boot() {
        installTopButton();
        watchGuide();

        // Первый прогон через 1 сек — если гайд уже был загружен
        setTimeout(tryEnhance, 1000);
        setTimeout(tryEnhance, 2000);

        console.log('[GuideEnhance] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
