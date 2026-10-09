/* ============================================================
   SOVEREIGNTY PANEL · PANEL-DETAIL.JS v1.2
   ============================================================
   Фаза 3 (детализация GUI). ФИКС v1.2:

     - Перехватываем window.renderCountries и window.renderPlayers
       у app.js. Наш рендер — финальный, без гонок.
     - Аватарки — всегда наш SVG (никогда внешние сервисы).
     - Дельта-бейдж всегда виден, включая "0".
     - Локальные скины из data/skins/{ник}.png (если есть).
     - Никаких MutationObserver-таймингов.

   ПОДКЛЮЧАТЬ ПОСЛЕ app.js и avatars.js:
     <script src="app.js"></script>
     <script src="avatars.js"></script>
     <script src="panel-detail.js"></script>
   ============================================================ */
(function () {
    'use strict';

    // ============================================================
    // 1. SVG-АВАТАРКИ — синхронная генерация, без внешних сервисов
    // ============================================================

    var FALLBACK_COLORS = [
        '#6366f1', '#818cf8', '#a78bfa', '#c084fc',
        '#e879f9', '#f472b6', '#fb7185', '#f97316',
        '#fbbf24', '#84cc16', '#22c55e', '#14b8a6',
        '#06b6d4', '#0ea5e9', '#3b82f6'
    ];

    function hashName(name) {
        var h = 0;
        for (var i = 0; i < name.length; i++) {
            h = ((h << 5) - h) + name.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    function makeSvgAvatar(name) {
        name = String(name || '?');
        var letter = name.charAt(0).toUpperCase();
        var color = FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length];
        var darker = shadeColor(color, -30);
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
                '<defs>' +
                    '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
                        '<stop offset="0%" stop-color="' + color + '"/>' +
                        '<stop offset="100%" stop-color="' + darker + '"/>' +
                    '</linearGradient>' +
                '</defs>' +
                '<rect width="64" height="64" rx="6" fill="url(#g)"/>' +
                '<text x="32" y="44" text-anchor="middle" ' +
                       'font-family="Georgia, serif" font-size="34" font-weight="800" ' +
                       'fill="rgba(255,255,255,0.95)">' +
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

    // ------------------------------------------------------------
    // Локальные скины
    // ------------------------------------------------------------
    var LOCAL_SKIN_DIR = 'data/skins/';
    var localSkinCache = new Map();   // name → dataURL | 'fail'
    var pendingSkins = new Map();

    function tryLoadLocalSkin(name) {
        if (localSkinCache.has(name)) return Promise.resolve(localSkinCache.get(name));
        if (pendingSkins.has(name)) return pendingSkins.get(name);

        var url = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
        var promise = new Promise(function (resolve) {
            var img = new Image();
            var done = false;
            var timer = setTimeout(function () {
                if (done) return;
                done = true;
                localSkinCache.set(name, 'fail');
                resolve('fail');
            }, 2000);
            img.onload = function () {
                if (done) return;
                done = true;
                clearTimeout(timer);
                if (img.width < 32 || img.height < 32) {
                    localSkinCache.set(name, 'fail');
                    resolve('fail');
                    return;
                }
                try {
                    var headUrl = headFromSkin(img);
                    localSkinCache.set(name, headUrl);
                    resolve(headUrl);
                } catch (e) {
                    localSkinCache.set(name, 'fail');
                    resolve('fail');
                }
            };
            img.onerror = function () {
                if (done) return;
                done = true;
                clearTimeout(timer);
                localSkinCache.set(name, 'fail');
                resolve('fail');
            };
            img.src = url;
        });
        pendingSkins.set(name, promise);
        return promise;
    }

    function headFromSkin(skinImg) {
        var c = document.createElement('canvas');
        c.width = 8;
        c.height = 8;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(skinImg, 8, 8, 8, 8, 0, 0, 8, 8);
        if (skinImg.width >= 64 && skinImg.height >= 64) {
            ctx.drawImage(skinImg, 40, 8, 8, 8, 0, 0, 8, 8);
        }
        return c.toDataURL('image/png');
    }

    /**
     * Синхронно возвращает URL для аватарки.
     * Если локальный скин уже загружен — dataURL.
     * Иначе — SVG. Параллельно пытается загрузить локальный скин,
     * если он ещё не проверялся, и по успеху обновит все <img>.
     */
    function avatarUrl(name) {
        name = String(name || '?');
        var cached = localSkinCache.get(name);
        if (cached && cached !== 'fail') return cached;

        if (!localSkinCache.has(name)) {
            tryLoadLocalSkin(name).then(function (result) {
                if (result === 'fail') return;
                var imgs = document.querySelectorAll('img[data-avatar-name="' + cssEsc(name) + '"]');
                for (var i = 0; i < imgs.length; i++) imgs[i].src = result;
            });
        }

        return makeSvgAvatar(name);
    }

    function cssEsc(s) {
        return String(s).replace(/["\\]/g, '\\$&');
    }

    // ============================================================
    // 2. СТАТ-КАРТОЧКИ
    // ============================================================
    var STAT_ICONS = {
        'countries-count': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L3 10 L8 5 L13 10 L13 21 Z"/><path d="M13 21 L13 14 L18 9 L21 11 L21 21 Z"/><path d="M6 12 L6 13 M6 16 L6 17 M16 15 L16 16"/></svg>',
        'total-claims': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 L9 4 L15 7 L21 4 L21 17 L15 20 L9 17 L3 20 Z"/><path d="M9 4 L9 17 M15 7 L15 20"/></svg>',
        'total-bank': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 L12 17 M9.5 9.5 L14.5 9.5 M9.5 14.5 L14.5 14.5"/></svg>',
        'total-energy': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/></svg>',
        'total-players': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 Q2.5 14 9 14 Q15.5 14 15.5 20"/><circle cx="17" cy="7" r="2.5" opacity=".7"/><path d="M17 12.5 Q21 13 21 18" opacity=".7"/></svg>'
    };

    var prevStatValues = {};

    function enhanceStatCards() {
        Object.keys(STAT_ICONS).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var card = el.closest('.stat-card');
            if (!card) return;

            var iconEl = card.querySelector('.stat-icon');
            if (iconEl && !iconEl.dataset.svg) {
                iconEl.dataset.svg = '1';
                iconEl.innerHTML = STAT_ICONS[id];
                iconEl.style.padding = '0';
            }

            var cur = el.textContent;
            var prev = prevStatValues[id];
            prevStatValues[id] = cur;
            if (prev === undefined || prev === cur) return;

            var oldVal = parseStatNumber(prev);
            var newVal = parseStatNumber(cur);
            if (oldVal === null || newVal === null) return;

            var diff = newVal - oldVal;
            if (Math.abs(diff) < 0.5) return;

            var trendEl = card.querySelector('.stat-trend');
            if (!trendEl) {
                trendEl = document.createElement('div');
                trendEl.className = 'stat-trend';
                card.appendChild(trendEl);
            }
            trendEl.classList.remove('up', 'down');
            trendEl.classList.add(diff > 0 ? 'up' : 'down');
            trendEl.textContent = (diff > 0 ? '▲ +' : '▼ −') + formatStatDiff(Math.abs(diff), cur);
        });
    }

    function parseStatNumber(text) {
        if (text == null) return null;
        var s = String(text).trim();
        if (s === '' || s === '—') return null;
        var m = 1;
        if (s.endsWith('M') || s.endsWith('М')) { m = 1e6; s = s.slice(0, -1); }
        else if (s.endsWith('k') || s.endsWith('К')) { m = 1e3; s = s.slice(0, -1); }
        var n = parseFloat(s.replace(/\s/g, '').replace(/,/g, '.'));
        if (isNaN(n)) return null;
        return n * m;
    }

    function formatStatDiff(diff, currentText) {
        var isK = /[kK]/.test(currentText);
        var isM = /[МM]/.test(currentText);
        if (isM) return (diff / 1e6).toFixed(1) + 'M';
        if (isK) {
            if (diff >= 1e6) return (diff / 1e6).toFixed(1) + 'M';
            if (diff >= 1000) return (diff / 1000).toFixed(1) + 'k';
        }
        if (diff >= 1000) return Math.round(diff) + '';
        if (diff < 10 && diff !== Math.floor(diff)) return diff.toFixed(1);
        return Math.round(diff).toString();
    }

    function markLiveStatCards() {
        var data = window.currentData;
        if (!data || !data.updated_at) return;
        var isFresh = (Date.now() - data.updated_at) < 60 * 1000;
        var cards = document.querySelectorAll('.stat-card');
        for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('is-live', isFresh);
    }

    // ============================================================
    // 3. ПОЛНАЯ ЗАМЕНА renderCountries
    // ============================================================

    /**
     * Заменяет app.js:renderCountries нашей версией.
     * Вызывается как window.renderCountries().
     */
    function renderCountriesCustom() {
        if (!window.currentData) return;
        var countries = (window.currentData.countries || []).slice();
        var sortMode = window.currentSort || 'claims';
        countries.sort(function (a, b) {
            if (sortMode === 'bank') return (b.bank || 0) - (a.bank || 0);
            if (sortMode === 'energy') return (b.energy || 0) - (a.energy || 0);
            if (sortMode === 'allies') return (b.allies || 0) - (a.allies || 0);
            if (sortMode === 'activity') return (b.activity || 0) - (a.activity || 0);
            return (b.claims || 0) - (a.claims || 0);
        });

        var tbody = document.getElementById('countries-body');
        if (!tbody) return;

        if (countries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">Пока нет стран.</td></tr>';
            return;
        }

        var html = '';
        for (var i = 0; i < countries.length; i++) {
            var c = countries[i];
            html += buildCountryRow(c, i);
        }
        tbody.innerHTML = html;
    }

    function buildCountryRow(c, idx) {
        var rank = idx + 1;
        var rankCls = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        var color = c.color || '#6366f1';

        var owner = c.owner || '?';
        var ownerName = String(owner);
        var avatarSrc = avatarUrl(ownerName);

        var claims = (c.claims || 0);
        var maxClaims = c.max_claims != null ? c.max_claims : '?';
        var delta = c.claims_delta_7d || 0;

        var deltaBadge;
        if (delta > 0) deltaBadge = '<span class="delta-badge up">▲ +' + delta + '</span>';
        else if (delta < 0) deltaBadge = '<span class="delta-badge down">▼ −' + Math.abs(delta) + '</span>';
        else deltaBadge = '<span class="delta-badge flat">0</span>';

        var capIcon = c.capital ? ' 🏛️' : '';

        return '<tr class="' + rankCls + '" style="--row-color:' + escapeAttr(color) + ';" ' +
                    'onclick="if(typeof showDetails===\'function\')showDetails(\'' + escapeAttr(c.name) + '\')">' +
                '<td class="rank">#' + rank + '</td>' +
                '<td class="name">' +
                    '<span class="country-dot" style="background:' + escapeAttr(color) + ';"></span> ' +
                    escapeHtml(c.name || '?') + capIcon +
                '</td>' +
                '<td>' +
                    '<span class="cell-owner">' +
                        '<img class="cell-owner-img" src="' + escapeAttr(avatarSrc) + '" ' +
                             'data-avatar-name="' + escapeAttr(ownerName) + '" alt="">' +
                        '<span class="cell-owner-name">' + escapeHtml(ownerName) + '</span>' +
                    '</span>' +
                '</td>' +
                '<td>' + claims + ' / ' + maxClaims + ' ' + deltaBadge + '</td>' +
                '<td class="money">' + formatMoney(c.bank || 0) + '</td>' +
                '<td class="energy">' + (c.energy || 0).toFixed(1) + '</td>' +
                '<td>' + (c.activity || 0) + '</td>' +
                '<td>' + (c.pacts || 0) + '</td>' +
            '</tr>';
    }

    // ============================================================
    // 4. ПОЛНАЯ ЗАМЕНА renderPlayers
    // ============================================================

    function renderPlayersCustom() {
        var grid = document.getElementById('players-grid');
        var empty = document.getElementById('players-empty');
        if (!grid || !empty) return;

        var players = (window.currentData && window.currentData.players) || null;
        if (!players || players.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        var q = (document.getElementById('player-search').value || '').trim().toLowerCase();
        var onlineOnly = document.getElementById('player-online-only').checked || false;

        var filtered = players.slice();
        if (q) filtered = filtered.filter(function (p) {
            return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
                   (p.country || '').toLowerCase().indexOf(q) !== -1;
        });
        if (onlineOnly) filtered = filtered.filter(function (p) { return p.online; });

        filtered.sort(function (a, b) {
            if (!!b.online !== !!a.online) return b.online ? 1 : -1;
            return (b.playtime_seconds || 0) - (a.playtime_seconds || 0);
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">Ничего не найдено.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            html += buildPlayerCard(filtered[i]);
        }
        grid.innerHTML = html;
    }

    function buildPlayerCard(p) {
        var name = p.name || '?';
        var avatar = avatarUrl(name);
        var badge = '';
        if (p.country_role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
        else if (p.country_role === 'co_ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';

        var pt = formatPlaytime(p.playtime_seconds);
        var money = p.balance != null ? formatMoney(p.balance) : null;
        var countryColor = p.country_color || '#8b91a6';

        return '<div class="player-card" onclick="if(typeof openPlayer===\'function\')openPlayer(\'' + escapeAttr(name) + '\')">' + badge +
            '<div class="player-card-avatar">' +
                '<img src="' + escapeAttr(avatar) + '" data-avatar-name="' + escapeAttr(name) + '" alt="">' +
                '<div class="status-dot ' + (p.online ? 'online' : 'offline') + '"></div>' +
            '</div>' +
            '<div class="player-card-info">' +
                '<div class="player-card-name">' + escapeHtml(name) + '</div>' +
                '<div class="player-card-country">' +
                    (p.country
                        ? '<span class="country-tag" style="color:' + escapeAttr(countryColor) + ';">🏛️ ' + escapeHtml(p.country) + '</span>'
                        : '<span class="no-country">Без страны</span>') +
                '</div>' +
                '<div class="player-card-meta">' +
                    (money != null ? '<span class="money">💰 ' + money + '</span>' : '') +
                    (pt ? '<span>⏱ ' + pt + '</span>' : '') +
                '</div>' +
            '</div>' +
        '</div>';
    }

    // ============================================================
    // 5. ГЛОБАЛЬНЫЕ ПЕРЕОПРЕДЕЛЕНИЯ
    // ============================================================

    function installOverrides() {
        // renderCountries
        if (typeof window.renderCountries === 'function' && !window.__rcOverridden) {
            window.__rcOverridden = true;
            window.renderCountries = renderCountriesCustom;
        }

        // renderPlayers
        if (typeof window.renderPlayers === 'function' && !window.__rpOverridden) {
            window.__rpOverridden = true;
            window.renderPlayers = renderPlayersCustom;
        }
    }

    // Локальные хелперы (дублируют app.js, чтобы не зависеть от порядка)
    function formatMoney(a) {
        if (a == null) return '0';
        var abs = Math.abs(a);
        if (abs >= 1000000) return (a / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (a / 1000).toFixed(1) + 'k';
        return Math.round(a).toString();
    }

    function formatPlaytime(s) {
        if (s == null || s <= 0) return '';
        var d = Math.floor(s / 86400);
        var h = Math.floor((s % 86400) / 3600);
        var m = Math.floor((s % 3600) / 60);
        if (d > 0) return h > 0 ? d + 'д ' + h + 'ч' : d + 'д';
        if (h > 0) return m > 0 ? h + 'ч ' + m + 'м' : h + 'ч';
        if (m > 0) return m + 'м';
        return (s % 60) + 'с';
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function escapeAttr(s) {
        return s == null ? '' : String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ============================================================
    // 6. Лента событий (дополняем, не заменяем)
    // ============================================================

    var NEW_BADGE_WINDOW_MS = 5 * 60 * 1000;

    function enhanceEventLog() {
        var items = document.querySelectorAll('#event-log-list .event-log-item');
        var now = Date.now();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.dataset.enhanced === '1') continue;
            item.dataset.enhanced = '1';
            try {
                var timeEl = item.querySelector('.event-log-time');
                var ts = timeEl ? parseTimeAgo(timeEl.textContent) : null;
                if (ts !== null && (now - ts) < NEW_BADGE_WINDOW_MS && i < 3) {
                    var msg = item.querySelector('.event-log-msg');
                    if (msg && !msg.querySelector('.event-new-badge')) {
                        msg.insertAdjacentHTML('beforeend', '<span class="event-new-badge">NEW</span>');
                    }
                }
                makeCountryLinks(item);
            } catch (e) {}
        }
    }

    function parseTimeAgo(text) {
        if (!text) return null;
        text = text.trim().toLowerCase();
        if (text === 'только что') return Date.now();
        var m = text.match(/(\d+)\s*(мин|мин\.|ч|час|дн|день)/);
        if (!m) return null;
        var n = parseInt(m[1], 10);
        var unit = m[2];
        var ms = 0;
        if (unit.startsWith('мин')) ms = n * 60 * 1000;
        else if (unit === 'ч' || unit.startsWith('час')) ms = n * 3600 * 1000;
        else if (unit.startsWith('дн')) ms = n * 24 * 3600 * 1000;
        return Date.now() - ms;
    }

    function makeCountryLinks(item) {
        var msg = item.querySelector('.event-log-msg');
        if (!msg || msg.dataset.linked === '1') return;
        msg.dataset.linked = '1';

        var data = window.currentData;
        if (!data || !data.countries) return;
        var countryNames = data.countries.map(function (c) { return c.name; });
        countryNames.sort(function (a, b) { return b.length - a.length; });

        var html = msg.innerHTML;
        for (var i = 0; i < countryNames.length; i++) {
            var name = countryNames[i];
            if (!name || name.length < 3) continue;
            var escaped = escapeHtml(name);
            var safeRe = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var re = new RegExp('(^|[^\\wа-яА-ЯёЁ])' + safeRe + '($|[^\\wа-яА-ЯёЁ])', 'g');
            html = html.replace(re,
                '$1<span class="country-link" onclick="if(typeof gotoCountry===\'function\')gotoCountry(\'' +
                escapeAttr(name) + '\');event.stopPropagation();">' + escaped + '</span>$2');
        }
        msg.innerHTML = html;
    }

    // ============================================================
    // 7. Boot
    // ============================================================

    // Многократная попытка перехвата — app.js мог ещё не загрузиться
    var tries = 0;
    function tryInstall() {
        tries++;
        installOverrides();
        // Если оба перехвата удались — прекращаем
        if (window.__rcOverridden && window.__rpOverridden) return;
        if (tries < 30) setTimeout(tryInstall, 100);
    }

    function boot() {
        tryInstall();

        // Первичная отрисовка через 400мс
        setTimeout(function () {
            enhanceStatCards();
            markLiveStatCards();
            // Принудительный ре-рендер
            if (window.__rcOverridden && window.renderCountries) window.renderCountries();
            if (window.__rpOverridden && window.renderPlayers) window.renderPlayers();
            enhanceEventLog();
        }, 400);

        // Tick на изменения
        var lastUpdatedAt = 0;
        setInterval(function () {
            try {
                var data = window.currentData;
                if (data && data.updated_at !== lastUpdatedAt) {
                    lastUpdatedAt = data.updated_at;
                    setTimeout(function () {
                        // app.js уже вызвал renderCountries — но если
                        // перехват удался, был вызван наш. Всё равно
                        // перерисуем для надёжности.
                        enhanceStatCards();
                        markLiveStatCards();
                        enhanceEventLog();
                    }, 300);
                }
            } catch (e) {}
        }, 800);

        console.log('[PanelDetail] v1.2 ready (override render)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.PanelDetail = {
        refresh: function () {
            enhanceStatCards();
            if (window.__rcOverridden) renderCountriesCustom();
            if (window.__rpOverridden) renderPlayersCustom();
            enhanceEventLog();
        }
    };
})();
