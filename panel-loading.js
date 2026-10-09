/* ============================================================
   SOVEREIGNTY PANEL · PANEL-LOADING.JS v1.0
   ============================================================
   Фаза 2 анимаций: скелетон-загрузка + подсветка нового контента.

   Что делает:
     1. Заменяет «⏳ Загрузка...» на shimmer-скелетон в таблице
        стран, ленте событий и списке игроков.
     2. Когда приходит новый event в event_log — добавляет flash-new.
     3. Когда меняется claims/bank/energy у страны — подсвечивает строку.
     4. Когда меняется «общее число стран» и т.п. — вспыхивает карточка.
     5. Отслеживает обновления JSON и подсвечивает только реально
        новое (не мигает на каждый рендер).

   Подключать ПОСЛЕ panel-ambient.js:
     <script src="panel-ambient.js?v=1.0"></script>
     <script src="panel-loading.js?v=1.0"></script>
   ============================================================ */
(function () {
    'use strict';

    var FLASH_DURATION_MS = 1800;

    // Хранилища предыдущего состояния
    var seenEventTs = new Set();
    var prevCountries = new Map();      // name → { claims, bank, energy, activity }
    var prevStatValues = {};            // id → textContent

    // ============================================================
    // 1. СКЕЛЕТОН ПРИ ЗАГРУЗКЕ
    // ============================================================

    function buildCountriesSkeleton() {
        var rows = '';
        for (var i = 0; i < 5; i++) {
            rows += '<tr class="skeleton-row">' +
                '<td><div class="panel-skeleton-block h-14 w-40"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-90"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-70"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-60"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-70"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-50"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-40"></div></td>' +
                '<td><div class="panel-skeleton-block h-14 w-30"></div></td>' +
                '</tr>';
        }
        return '<tbody>' + rows + '</tbody>';
    }

    function buildEventLogSkeleton() {
        var items = '';
        for (var i = 0; i < 4; i++) {
            items += '<div class="panel-skeleton-row" style="padding:12px;background:rgba(0,0,0,.15);border-radius:8px;">' +
                '<div class="panel-skeleton-block h-20 w-20 round"></div>' +
                '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">' +
                '<div class="panel-skeleton-block h-14 w-90"></div>' +
                '<div class="panel-skeleton-block h-10 w-40"></div>' +
                '</div></div>';
        }
        return '<div class="panel-skeleton">' + items + '</div>';
    }

    function buildPlayersSkeleton() {
        var cards = '';
        for (var i = 0; i < 6; i++) {
            cards += '<div class="panel-skeleton-player">' +
                '<div class="panel-skeleton-block h-48 w-48 round"></div>' +
                '<div class="panel-skeleton-player-inner">' +
                '<div class="panel-skeleton-block h-14 w-60"></div>' +
                '<div class="panel-skeleton-block h-10 w-40"></div>' +
                '<div class="panel-skeleton-block h-10 w-70"></div>' +
                '</div></div>';
        }
        return cards;
    }

    function injectSkeletons() {
        // Таблица стран
        var tbody = document.getElementById('countries-body');
        if (tbody && tbody.textContent.indexOf('Загрузка') !== -1) {
            tbody.innerHTML = buildCountriesSkeleton();
        }

        // Лента событий
        var log = document.getElementById('event-log-list');
        if (log && log.textContent.indexOf('Загрузка') !== -1) {
            log.innerHTML = buildEventLogSkeleton();
        }

        // Список игроков (пусто при первой загрузке)
        var playersGrid = document.getElementById('players-grid');
        if (playersGrid && playersGrid.children.length === 0) {
            var empty = document.getElementById('players-empty');
            var isHidden = !empty || empty.style.display === 'none';
            if (isHidden) {
                playersGrid.innerHTML = buildPlayersSkeleton();
            }
        }

        // Онлайн-график
        var spark = document.getElementById('sparkline-canvas');
        if (spark && !spark.dataset.skeletonDone) {
            var ctx = spark.getContext('2d');
            if (ctx) {
                spark.dataset.skeletonDone = '1';
                var w = spark.clientWidth || 800;
                var h = 160;
                var dpr = window.devicePixelRatio || 1;
                spark.width = w * dpr;
                spark.height = h * dpr;
                spark.style.width = w + 'px';
                spark.style.height = h + 'px';
                ctx.scale(dpr, dpr);
                ctx.fillStyle = '#0a0c12';
                ctx.fillRect(0, 0, w, h);
                // Скелетон-линия
                ctx.strokeStyle = 'rgba(99, 102, 241, .15)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, h * 0.6);
                for (var i = 0; i < w; i += 40) {
                    ctx.lineTo(i, h * 0.6 + Math.sin(i / 40) * 20);
                }
                ctx.stroke();
            }
        }
    }

    // ============================================================
    // 2. ПОДСВЕТКА НОВЫХ EVENT LOG ЗАПИСЕЙ
    // ============================================================

    function flashNewEventItems() {
        var items = document.querySelectorAll('#event-log-list .event-log-item');
        var didFlash = false;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.dataset.seen === '1') continue;

            // Извлекаем timestamp из текста (формат "X мин назад" / "только что")
            // Проще: flash только первые 2 сверху, если они появились впервые
            // после того, как мы уже видели какие-то.
            var key = item.textContent.trim().substring(0, 60);
            if (seenEventTs.has(key)) {
                item.dataset.seen = '1';
                continue;
            }

            if (i > 1) {
                // Старые записи — просто помечаем seen без вспышки
                seenEventTs.add(key);
                item.dataset.seen = '1';
                continue;
            }

            seenEventTs.add(key);
            item.dataset.seen = '1';
            item.classList.add('flash-new');
            didFlash = true;
            (function (el) {
                setTimeout(function () {
                    el.classList.remove('flash-new');
                }, FLASH_DURATION_MS);
            })(item);
        }

        // Ограничиваем размер Set
        if (seenEventTs.size > 100) {
            var arr = Array.from(seenEventTs);
            seenEventTs = new Set(arr.slice(-50));
        }
    }

    // ============================================================
    // 3. ПОДСВЕТКА ОБНОВЛЁННЫХ СТРОК В ТАБЛИЦЕ СТРАН
    // ============================================================

    function flashUpdatedCountryRows() {
        if (!window.currentData) return;
        var countries = window.currentData.countries || [];
        var newPrev = new Map();

        for (var i = 0; i < countries.length; i++) {
            var c = countries[i];
            var prev = prevCountries.get(c.name);
            var cur = {
                claims: c.claims,
                bank: c.bank,
                energy: c.energy,
                activity: c.activity
            };
            newPrev.set(c.name, cur);

            // Первый рендер — не мигаем
            if (!prev) continue;

            var claimsChanged = prev.claims !== cur.claims;
            var bankChanged = prev.bank !== cur.bank;
            var energyChanged = prev.energy !== cur.energy;
            var activityChanged = prev.activity !== cur.activity;

            if (!claimsChanged && !bankChanged && !energyChanged && !activityChanged) continue;

            // Ищем строку в DOM
            var tbody = document.getElementById('countries-body');
            if (!tbody) continue;
            var rows = tbody.querySelectorAll('tr');
            for (var r = 0; r < rows.length; r++) {
                var row = rows[r];
                var cellName = row.querySelector('td.name');
                if (!cellName) continue;
                if (cellName.textContent.indexOf(c.name) === -1) continue;
                row.classList.add('row-flash-new');
                (function (el) {
                    setTimeout(function () {
                        el.classList.remove('row-flash-new');
                    }, FLASH_DURATION_MS);
                })(row);
                break;
            }
        }

        prevCountries = newPrev;
    }

    // ============================================================
    // 4. FLASH STAT-CARD ПРИ ИЗМЕНЕНИИ ЧИСЛА
    // ============================================================

    var STAT_IDS = [
        'countries-count', 'total-claims', 'total-bank',
        'total-energy', 'total-players',
        'online-now', 'online-avg', 'online-peak',
        'jackpot-value'
    ];

    function flashChangedStatCards() {
        for (var i = 0; i < STAT_IDS.length; i++) {
            var id = STAT_IDS[i];
            var el = document.getElementById(id);
            if (!el) continue;
            var cur = el.textContent;
            var prev = prevStatValues[id];
            prevStatValues[id] = cur;
            if (prev === undefined || prev === cur) continue;

            // Находим родительскую карточку
            var card = el.closest('.stat-card');
            if (card) {
                card.classList.add('stat-flash');
                (function (c) {
                    setTimeout(function () { c.classList.remove('stat-flash'); }, 1400);
                })(card);
            }

            // Jackpot — своя анимация
            if (id === 'jackpot-value') {
                el.classList.add('flash-new');
                (function (e) {
                    setTimeout(function () { e.classList.remove('flash-new'); }, 1200);
                })(el);
            }
        }
    }

    // ============================================================
    // 5. НАБЛЮДЕНИЕ ЗА ОБНОВЛЕНИЯМИ
    // ============================================================

    function installUpdateHook() {
        var lastUpdatedAt = 0;

        function check() {
            try {
                var data = window.currentData;
                if (data && data.updated_at && data.updated_at !== lastUpdatedAt) {
                    lastUpdatedAt = data.updated_at;
                    // Небольшая задержка, чтобы app.js успел отрендерить DOM
                    setTimeout(function () {
                        flashNewEventItems();
                        flashUpdatedCountryRows();
                        flashChangedStatCards();
                    }, 200);
                }
            } catch (e) {}
            setTimeout(check, 1200);
        }
        check();
    }

    // Скелетоны перепроверяем каждые 300мс, пока данные не пришли
    function installSkeletonWatcher() {
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            injectSkeletons();
            var data = window.currentData;
            if (data || tries > 20) clearInterval(iv);
        }, 300);
    }

    // ============================================================
    // Boot
    // ============================================================

    function boot() {
        injectSkeletons();
        installSkeletonWatcher();
        installUpdateHook();

        // Первый прогон — пометить существующее как «увидено»
        setTimeout(function () {
            try {
                if (window.currentData) {
                    // Первичная инициализация prevCountries / statValues
                    // без вспышек — чтобы не мигало на старте.
                    var countries = window.currentData.countries || [];
                    for (var i = 0; i < countries.length; i++) {
                        var c = countries[i];
                        prevCountries.set(c.name, {
                            claims: c.claims,
                            bank: c.bank,
                            energy: c.energy,
                            activity: c.activity
                        });
                    }
                    for (var j = 0; j < STAT_IDS.length; j++) {
                        var el = document.getElementById(STAT_IDS[j]);
                        if (el) prevStatValues[STAT_IDS[j]] = el.textContent;
                    }
                    // Помечаем существующие события как seen без вспышки
                    var items = document.querySelectorAll('#event-log-list .event-log-item');
                    for (var k = 0; k < items.length; k++) {
                        var key = items[k].textContent.trim().substring(0, 60);
                        seenEventTs.add(key);
                        items[k].dataset.seen = '1';
                    }
                }
            } catch (e) {}
        }, 2500);

        console.log('[PanelLoading] v1.0 ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Публичный API
    window.PanelLoading = {
        refresh: function () {
            flashNewEventItems();
            flashUpdatedCountryRows();
            flashChangedStatCards();
        },
        reinitSkeletons: injectSkeletons
    };
})();
