/* ============================================================
   SOVEREIGNTY PANEL · PERF-BUNDLE.JS v1.1
   ============================================================
   v1.1 (07.11.2026):
     - renderChronicles: добавлен replaceEmojisInElement(feed) в конце
       (раньше не вызывался → эмодзи в хрониках оставались).
     - ensureMoreLink: SVG-иконки scroll+arrowright вместо 📜 и →.
     - EMOJI_MAP расширен типографскими символами:
       → ← ↑ ↓ ✕ ✓ ✔ ▸ ▾ ▶ ⏸ §.
     - MutationObserver на #guide-content (гайд грузится через fetch
       и эмодзи оставались) + на #player-modal-panels и #pp-body.
     - Helper replaceEmojisInElement(root) — точечная замена.
   ============================================================ */
(function () {
    'use strict';

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
    function formatPlaytime(s) {
        if (s == null || s <= 0) return '';
        var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
        if (d > 0) return h > 0 ? d + 'д ' + h + 'ч' : d + 'д';
        if (h > 0) return m > 0 ? h + 'ч ' + m + 'м' : h + 'ч';
        if (m > 0) return m + 'м';
        return (s % 60) + 'с';
    }
    function timeAgo(ts) {
        if (!ts) return '';
        var s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'только что';
        var m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
        var h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
        return Math.floor(h / 24) + ' дн назад';
    }
    function pad2(n) { return n < 10 ? '0' + n : String(n); }
    function isTabActive(tabKey) {
        var t = document.getElementById('tab-' + tabKey);
        return !!(t && t.classList.contains('active'));
    }
    function isDocumentVisible() { return document.visibilityState !== 'hidden'; }

    /* ============================================================
       1. ЦЕНТРАЛЬНЫЙ ТИКЕР
       ============================================================ */
    var ticker = {
        subs: [],
        lastUpdatedAt: 0,
        intervalId: null,
        suspended: false,
        subscribe: function (fn) {
            this.subs.push(fn);
            if (this.lastUpdatedAt) { try { fn(this.lastUpdatedAt); } catch (e) {} }
        },
        start: function () {
            if (this.intervalId) return;
            var self = this;
            this.intervalId = setInterval(function () { self.tick(); }, 1500);
        },
        stop: function () {
            if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
        },
        suspend: function () { this.suspended = true; this.stop(); },
        resume: function () { this.suspended = false; this.start(); this.tick(); },
        tick: function () {
            if (!isDocumentVisible()) return;
            var data = window.currentData;
            if (!data || !data.updated_at) return;
            if (data.updated_at === this.lastUpdatedAt) return;
            this.lastUpdatedAt = data.updated_at;
            for (var i = 0; i < this.subs.length; i++) {
                try { this.subs[i](this.lastUpdatedAt); } catch (e) {
                    console.error('[PerfBundle:tick]', e);
                }
            }
        }
    };

    /* ============================================================
       2. ЦЕНТРАЛЬНЫЙ MUTATIONOBSERVER
       ============================================================ */
    var observer = {
        jobs: [],
        scheduled: {},
        add: function (key, target, cb, debounceMs) {
            if (!target) return;
            if (this.jobs.some(function (j) { return j.key === key; })) return;
            var self = this;
            this.jobs.push({ key: key, target: target, cb: cb, debounce: debounceMs || 80 });
            var mo = new MutationObserver(function () {
                if (self.scheduled[key]) return;
                self.scheduled[key] = true;
                setTimeout(function () {
                    self.scheduled[key] = false;
                    if (!isDocumentVisible()) return;
                    try { cb(); } catch (e) { console.error('[PerfBundle:mo]', key, e); }
                }, debounceMs || 80);
            });
            mo.observe(target, { childList: true, subtree: false });
        }
    };

    /* ============================================================
       3. АВАТАРЫ
       ============================================================ */
    var FALLBACK_COLORS = [
        '#6366f1','#818cf8','#a78bfa','#c084fc','#e879f9','#f472b6',
        '#fb7185','#f97316','#fbbf24','#84cc16','#22c55e','#14b8a6',
        '#06b6d4','#0ea5e9','#3b82f6'
    ];
    function hashName(name) {
        var h = 0, s = String(name || '?');
        for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
        return Math.abs(h);
    }
    function shadeColor(hex, pct) {
        var num = parseInt(hex.replace('#',''), 16);
        var r = Math.max(0, Math.min(255, (num >> 16) + pct));
        var g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + pct));
        var b = Math.max(0, Math.min(255, (num & 0xff) + pct));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }
    function makeSvgAvatar(name, size) {
        size = size || 64;
        name = String(name || '?');
        var letter = name.charAt(0).toUpperCase();
        var color = FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length];
        var darker = shadeColor(color, -25);
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + size + '" height="' + size + '">' +
                '<defs><linearGradient id="g' + hashName(name) + '" x1="0" y1="0" x2="0" y2="1">' +
                    '<stop offset="0%" stop-color="' + color + '"/>' +
                    '<stop offset="100%" stop-color="' + darker + '"/>' +
                '</linearGradient></defs>' +
                '<rect width="64" height="64" rx="8" fill="url(#g' + hashName(name) + ')"/>' +
                '<text x="32" y="43" text-anchor="middle" font-family="Georgia,serif" ' +
                    'font-size="34" font-weight="800" fill="rgba(255,255,255,0.92)">' +
                    letter.replace(/[<>&"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }) +
                '</text>' +
            '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    var LOCAL_SKIN_DIR = 'data/skins/';
    var localSkinCache = new Map();
    var pendingSkins = new Map();

    function tryLoadLocalSkin(name) {
        if (localSkinCache.has(name)) return Promise.resolve(localSkinCache.get(name));
        if (pendingSkins.has(name)) return pendingSkins.get(name);
        var url = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
        var promise = new Promise(function (resolve) {
            var img = new Image();
            var done = false;
            var timer = setTimeout(function () {
                if (done) return; done = true;
                localSkinCache.set(name, 'fail'); resolve('fail');
            }, 3000);
            img.onload = function () {
                if (done) return; done = true; clearTimeout(timer);
                if (img.width < 32 || img.height < 32) { localSkinCache.set(name, 'fail'); resolve('fail'); return; }
                try {
                    var c = document.createElement('canvas');
                    c.width = 8; c.height = 8;
                    var ctx = c.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
                    if (img.width >= 64 && img.height >= 64) ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
                    var dataUrl = c.toDataURL('image/png');
                    localSkinCache.set(name, dataUrl); resolve(dataUrl);
                } catch (e) { localSkinCache.set(name, 'fail'); resolve('fail'); }
            };
            img.onerror = function () {
                if (done) return; done = true; clearTimeout(timer);
                localSkinCache.set(name, 'fail'); resolve('fail');
            };
            img.src = url;
        });
        pendingSkins.set(name, promise);
        return promise;
    }

    function getAvatar(name, size) {
        if (!name) name = '?';
        var local = localSkinCache.get(name);
        if (local && local !== 'fail') return local;
        if (local === undefined) {
            tryLoadLocalSkin(name).then(function (result) {
                if (result === 'fail') return;
                var imgs = document.querySelectorAll('img[data-avatar-name="' + name.replace(/["\\]/g, '\\$&') + '"]');
                for (var i = 0; i < imgs.length; i++) imgs[i].src = result;
            });
        }
        return makeSvgAvatar(name, size || 64);
    }

    function refreshAvatars() {
        var imgs = document.querySelectorAll('img[data-avatar-name]');
        for (var i = 0; i < imgs.length; i++) {
            var name = imgs[i].getAttribute('data-avatar-name');
            if (!name) continue;
            var local = localSkinCache.get(name);
            if (local && local !== 'fail') imgs[i].src = local;
        }
    }

    /* ============================================================
       4. СТАТ-КАРТОЧКИ
       ============================================================ */
    var STAT_ICONS = {
        'countries-count': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L3 10 L8 5 L13 10 L13 21 Z"/><path d="M13 21 L13 14 L18 9 L21 11 L21 21 Z"/><path d="M6 12 L6 13 M6 16 L6 17 M16 15 L16 16"/></svg>',
        'total-claims': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 L9 4 L15 7 L21 4 L21 17 L15 20 L9 17 L3 20 Z"/><path d="M9 4 L9 17 M15 7 L15 20"/></svg>',
        'total-bank': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 L12 17 M9.5 9.5 L14.5 9.5 M9.5 14.5 L14.5 14.5"/></svg>',
        'total-energy': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/></svg>',
        'total-players': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 Q2.5 14 9 14 Q15.5 14 15.5 20"/><circle cx="17" cy="7" r="2.5" opacity=".7"/><path d="M17 12.5 Q21 13 21 18" opacity=".7"/></svg>'
    };
    function injectStatSvgs() {
        Object.keys(STAT_ICONS).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var card = el.closest('.stat-card');
            if (!card) return;
            var icon = card.querySelector('.stat-icon');
            if (!icon || icon.querySelector('svg')) return;
            icon.innerHTML = STAT_ICONS[id];
            icon.style.padding = '0';
        });
    }

    /* ============================================================
       5. RENDER COUNTRIES
       ============================================================ */
    function renderCountries() {
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
        for (var i = 0; i < countries.length; i++) html += buildCountryRow(countries[i], i);
        tbody.innerHTML = html;
    }

    function buildCountryRow(c, idx) {
        var rank = idx + 1;
        var rankCls = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        var color = c.color || '#6366f1';
        var ownerName = String(c.owner || '?');
        var avatarSrc = getAvatar(ownerName, 32);
        var delta = c.claims_delta_7d || 0;
        var deltaBadge =
            delta > 0 ? '<span class="delta-badge up">▲ +' + delta + '</span>' :
            delta < 0 ? '<span class="delta-badge down">▼ −' + Math.abs(delta) + '</span>' :
            '<span class="delta-badge flat">0</span>';
        var capIcon = c.capital ? ' 🏛️' : '';
        return '<tr class="' + rankCls + '" style="--row-color:' + escapeAttr(color) + ';" ' +
                'onclick="if(typeof showDetails===\'function\')showDetails(\'' + escapeAttr(c.name) + '\')">' +
            '<td class="rank">#' + rank + '</td>' +
            '<td class="name"><span class="country-dot" style="background:' + escapeAttr(color) + ';"></span> ' +
                escapeHtml(c.name || '?') + capIcon + '</td>' +
            '<td><span class="cell-owner">' +
                '<img class="cell-owner-img" loading="lazy" src="' + escapeAttr(avatarSrc) + '" ' +
                    'data-avatar-name="' + escapeAttr(ownerName) + '" alt="">' +
                '<span class="cell-owner-name">' + escapeHtml(ownerName) + '</span>' +
            '</span></td>' +
            '<td>' + (c.claims || 0) + ' / ' + (c.max_claims != null ? c.max_claims : '?') + ' ' + deltaBadge + '</td>' +
            '<td class="money">' + formatMoney(c.bank || 0) + '</td>' +
            '<td class="energy">' + (c.energy || 0).toFixed(1) + '</td>' +
            '<td>' + (c.activity || 0) + '</td>' +
            '<td>' + (c.pacts || 0) + '</td>' +
        '</tr>';
    }

    /* ============================================================
       6. RENDER PLAYERS
       ============================================================ */
    function renderPlayers() {
        var grid = document.getElementById('players-grid');
        var empty = document.getElementById('players-empty');
        if (!grid || !empty) return;
        var players = (window.currentData && window.currentData.players) || null;
        if (!players || players.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        var searchEl = document.getElementById('player-search');
        var onlineEl = document.getElementById('player-online-only');
        var q = (searchEl ? searchEl.value : '').trim().toLowerCase();
        var onlineOnly = onlineEl ? onlineEl.checked : false;
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
        for (var i = 0; i < filtered.length; i++) html += buildPlayerCard(filtered[i]);
        grid.innerHTML = html;
    }

    function buildPlayerCard(p) {
        var name = p.name || '?';
        var avatar = getAvatar(name, 64);
        var badge = '';
        if (p.country_role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
        else if (p.country_role === 'co_ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';
        var pt = formatPlaytime(p.playtime_seconds);
        var money = p.balance != null ? formatMoney(p.balance) : null;
        var color = p.country_color || '#8b91a6';
        return '<div class="player-card" onclick="if(typeof openPlayer===\'function\')openPlayer(\'' + escapeAttr(name) + '\')">' + badge +
            '<div class="player-card-avatar">' +
                '<img loading="lazy" src="' + escapeAttr(avatar) + '" data-avatar-name="' + escapeAttr(name) + '" alt="">' +
                '<div class="status-dot ' + (p.online ? 'online' : 'offline') + '"></div>' +
            '</div>' +
            '<div class="player-card-info">' +
                '<div class="player-card-name">' + escapeHtml(name) + '</div>' +
                '<div class="player-card-country">' +
                    (p.country
                        ? '<span class="country-tag" style="color:' + escapeAttr(color) + ';">🏛️ ' + escapeHtml(p.country) + '</span>'
                        : '<span class="no-country">Без страны</span>') +
                '</div>' +
                '<div class="player-card-meta">' +
                    (money != null ? '<span class="money">💰 ' + money + '</span>' : '') +
                    (pt ? '<span>⏱ ' + pt + '</span>' : '') +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /* ============================================================
       7. COUNTRY CARDS
       ============================================================ */
    function ensureCardsContainer() {
        var tbody = document.getElementById('countries-body');
        if (!tbody) return null;
        var existing = document.getElementById('country-cards-mobile');
        if (existing) return existing;
        var wrap = tbody.closest('.table-wrap');
        var parent = wrap ? wrap.parentNode : tbody.closest('.panel');
        if (!parent) return null;
        var container = document.createElement('div');
        container.id = 'country-cards-mobile';
        container.className = 'country-cards-mobile';
        if (wrap && wrap.nextSibling) parent.insertBefore(container, wrap.nextSibling);
        else parent.appendChild(container);
        return container;
    }

    function renderCards() {
        var container = ensureCardsContainer();
        if (!container) return;
        var data = window.currentData;
        if (!data) return;
        var countries = (data.countries || []).slice();
        var sortMode = window.currentSort || 'claims';
        countries.sort(function (a, b) {
            if (sortMode === 'bank') return (b.bank || 0) - (a.bank || 0);
            if (sortMode === 'energy') return (b.energy || 0) - (a.energy || 0);
            if (sortMode === 'allies') return (b.allies || 0) - (a.allies || 0);
            if (sortMode === 'activity') return (b.activity || 0) - (a.activity || 0);
            return (b.claims || 0) - (a.claims || 0);
        });
        if (countries.length === 0) {
            container.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">Пока нет стран.</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < countries.length; i++) html += buildCard(countries[i], i);
        container.innerHTML = html;
        if (isTabActive('countries')) injectSparklines();
    }

    function buildCard(c, idx) {
        var rank = idx + 1;
        var rankCls = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        var color = c.color || '#6366f1';
        var ownerName = String(c.owner || '?');
        var avatarSrc = getAvatar(ownerName, 32);
        var claims = c.claims || 0;
        var maxClaims = c.max_claims != null ? c.max_claims : '?';
        var delta = c.claims_delta_7d || 0;
        var deltaCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        var deltaStr = delta > 0 ? '▲ +' + delta : delta < 0 ? '▼ −' + Math.abs(delta) : '0';
        var capIcon = c.capital ? ' 🏛️' : '';
        return '<article class="ccm-card" style="--row-color:' + escapeAttr(color) + ';" ' +
                'onclick="if(typeof showDetails===\'function\')showDetails(\'' + escapeAttr(c.name) + '\')">' +
            '<div class="ccm-head">' +
                '<div class="ccm-rank ' + rankCls + '">#' + rank + '</div>' +
                '<div class="ccm-name-block">' +
                    '<div class="ccm-name">' + escapeHtml(c.name || '?') + capIcon + '</div>' +
                    '<div class="ccm-owner">' +
                        '<img loading="lazy" class="ccm-avatar" src="' + escapeAttr(avatarSrc) + '" ' +
                             'data-avatar-name="' + escapeAttr(ownerName) + '" alt="">' +
                        '<span>' + escapeHtml(ownerName) + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="ccm-stats">' +
                '<div class="ccm-stat"><span class="ccm-stat-label">Чанков</span>' +
                    '<span class="ccm-stat-value">' + claims + ' / ' + maxClaims + '</span></div>' +
                '<div class="ccm-stat"><span class="ccm-stat-label">Казна</span>' +
                    '<span class="ccm-stat-value money">' + formatMoney(c.bank || 0) + '</span></div>' +
                '<div class="ccm-stat"><span class="ccm-stat-label">Энергия</span>' +
                    '<span class="ccm-stat-value energy">' + (c.energy || 0).toFixed(1) + '</span></div>' +
                '<div class="ccm-stat"><span class="ccm-stat-label">Рост 7д</span>' +
                    '<span class="ccm-stat-value delta ' + deltaCls + '">' + deltaStr + '</span></div>' +
                '<div class="ccm-stat"><span class="ccm-stat-label">Активность</span>' +
                    '<span class="ccm-stat-value">' + (c.activity || 0) + '</span></div>' +
                '<div class="ccm-stat"><span class="ccm-stat-label">Пакты</span>' +
                    '<span class="ccm-stat-value">' + (c.pacts || 0) + '</span></div>' +
            '</div>' +
        '</article>';
    }

    /* ============================================================
       8. SPARKLINES
       ============================================================ */
    function buildSparklineSVG(history, color) {
        if (!history || history.length < 2) return '';
        var W = 100, H = 28, padX = 2, padY = 4;
        var min = Math.min.apply(null, history);
        var max = Math.max.apply(null, history);
        var range = max - min || 1;
        var innerW = W - padX * 2, innerH = H - padY * 2;
        var pts = [];
        for (var i = 0; i < history.length; i++) {
            var x = padX + (i / (history.length - 1)) * innerW;
            var y = padY + (1 - (history[i] - min) / range) * innerH;
            pts.push({ x: x, y: y });
        }
        var lineD = pts.map(function (p, i) {
            return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
        }).join(' ');
        var fillD = lineD + ' L' + pts[pts.length - 1].x.toFixed(1) + ',' + (H - padY) +
            ' L' + pts[0].x.toFixed(1) + ',' + (H - padY) + ' Z';
        var last = pts[pts.length - 1];
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
                'class="ccm-sparkline-svg" preserveAspectRatio="none" aria-hidden="true">' +
            '<path d="' + fillD + '" fill="' + color + '" fill-opacity="0.15" stroke="none"/>' +
            '<path d="' + lineD + '" fill="none" stroke="' + color + '" stroke-width="1.6" ' +
                'stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" r="2.2" ' +
                'fill="' + color + '" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/>' +
        '</svg>';
    }

    function injectSparklines() {
        var container = document.getElementById('country-cards-mobile');
        if (!container) return;
        var data = window.currentData;
        if (!data || !data.countries) return;
        var map = {};
        data.countries.forEach(function (c) { map[c.name] = c; });
        var cards = container.querySelectorAll('.ccm-card');
        for (var ci = 0; ci < cards.length; ci++) {
            var card = cards[ci];
            if (card.querySelector('.ccm-sparkline-wrap')) continue;
            var nameEl = card.querySelector('.ccm-name');
            if (!nameEl) continue;
            var name = nameEl.textContent.replace(/🏛️/g, '').trim();
            var country = map[name];
            if (!country) continue;
            var history = country.claims_history;
            if (!history || history.length < 2) continue;
            var color = country.color || '#6366f1';
            var wrap = document.createElement('div');
            wrap.className = 'ccm-sparkline-wrap';
            wrap.innerHTML = buildSparklineSVG(history, color);
            var delta = country.claims_delta_7d || 0;
            var deltaStr = delta > 0 ? '+' + delta : (delta < 0 ? String(delta) : '0');
            var deltaCls = delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat');
            var label = document.createElement('div');
            label.className = 'ccm-sparkline-label ccm-stat-value delta ' + deltaCls;
            label.textContent = deltaStr;
            wrap.appendChild(label);
            card.appendChild(wrap);
        }
    }

    /* ============================================================
       9. ЭМОДЗИ → SVG
       ============================================================ */
    var EMOJI_MAP = {
        '🏠':'home','🗺':'map','🗺️':'map','👥':'users','📜':'scroll',
        '📖':'book','⌨':'keyboard','⌨️':'keyboard','🎁':'gift',
        '🌓':'theme','🌙':'moon','☀':'sun','☀️':'sun','🔄':'refresh',
        '🏛':'landmark','🏛️':'landmark','🏰':'castle','🏦':'bank',
        '💰':'money','💸':'money-out','💵':'money','⚡':'bolt',
        '📈':'chart','📉':'chart-down','📊':'chart','🏆':'trophy',
        '✨':'sparkles','🌱':'sprout','🎯':'target','💡':'bulb',
        '👁':'eye','👁️':'eye','📝':'memo','🪟':'window',
        '⚔':'war','⚔️':'war','🤝':'handshake','👑':'crown',
        '⚓':'anchor','⭐':'star','🔥':'flame','❄':'snow','❄️':'snow',
        '🌊':'wave','🌲':'tree','🌵':'cactus','🌾':'wheat',
        '🗡':'sword','🗡️':'sword','🛡':'shield','🛡️':'shield',
        '✝':'cross','✝️':'cross','🔑':'key','🔨':'hammer','🍷':'chalice',
        '⛏':'pickaxe','⛏️':'pickaxe','💎':'gem','📦':'treasure','🏹':'hunt',
        '👤':'group','⚖':'scales','⚖️':'scales','🕊':'dove','🕊️':'dove',
        '💬':'speech','📋':'clipboard','💀':'skull','☠':'skull','☠️':'skull',
        '🎰':'casino','🎲':'casino','🎬':'movie','🔬':'microscope',
        '🏗':'construction','🏗️':'construction','🏪':'shop','🛒':'cart',
        '🚫':'ban','⚠':'warning','⚠️':'warning','🎨':'palette',
        '🖼':'image','🖼️':'image','🔍':'search','ℹ':'info','ℹ️':'info',
        '✏':'pen','✏️':'pen','🗑':'trash','🗑️':'trash','🚪':'logout',
        '🚩':'flag','⌛':'time','⏳':'time','📍':'map-pin','🧭':'compass',
        '🏔':'mountains','🏔️':'mountains','💥':'boom','❓':'info','❗':'info',
        /* v1.1: типографские символы */
        '→': 'arrowright',
        '←': 'arrowleft',
        '↑': 'arrowup',
        '↓': 'arrowdown',
        '✕': 'close',
        '✖': 'close',
        '✓': 'check',
        '✔': 'check',
        '▸': 'chevron-right',
        '▾': 'chevron-down',
        '▶': 'play',
        '⏸': 'pause',
        '⏱': 'clock'
    };
    var SKIP_EMOJI_SELECTOR = 'script,style,textarea,input,select,option,code,pre,.panel-icon,[data-icon],[data-icon-done],svg,.emoji-icon';

    /* Regex строится из ключей EMOJI_MAP с учётом длины (сначала длинные).
       Это гарантирует, что 🗺️ (emoji+VS16) не съедается как 🗺. */
    var EMOJI_KEYS_SORTED = Object.keys(EMOJI_MAP).sort(function (a, b) {
        return b.length - a.length;
    });
    var EMOJI_RE_SOURCE = '(' + EMOJI_KEYS_SORTED.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')';

    function replaceEmojisInNode(textNode) {
        var str = textNode.nodeValue;
        if (!str) return;
        var parent = textNode.parentNode;
        if (!parent || parent.closest(SKIP_EMOJI_SELECTOR)) return;
        var re = new RegExp(EMOJI_RE_SOURCE, 'g');
        if (!re.test(str)) return;
        re.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m, replaced = false;
        while ((m = re.exec(str)) !== null) {
            if (m.index > last) frag.appendChild(document.createTextNode(str.substring(last, m.index)));
            var iconName = EMOJI_MAP[m[0]];
            var svg = null;
            if (window.PanelIcons && window.PanelIcons.element) {
                svg = window.PanelIcons.element(iconName, 16);
                if (svg) {
                    svg.classList.remove('panel-icon');
                    svg.classList.add('emoji-icon');
                }
            }
            if (svg) { frag.appendChild(svg); replaced = true; }
            else frag.appendChild(document.createTextNode(m[0]));
            last = m.index + m[0].length;
        }
        if (last < str.length) frag.appendChild(document.createTextNode(str.substring(last)));
        if (!replaced) return;
        try { parent.replaceChild(frag, textNode); } catch (e) {}
    }

    /* v1.1: точечная замена в конкретном root. Не трогает body. */
    function replaceEmojisInElement(root) {
        if (!root || !window.PanelIcons) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (node.parentNode && node.parentNode.closest(SKIP_EMOJI_SELECTOR)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        for (var i = 0; i < nodes.length; i++) replaceEmojisInNode(nodes[i]);
    }

    function replaceEmojisInVisibleTab() {
        var active = document.querySelector('.tab-content.active');
        if (active) replaceEmojisInElement(active);
    }

    /* ============================================================
       10. EVENT LOG 24H
       ============================================================ */
    var KEY_LAST = 'panel_last_visit';
    var KEY_SESS = 'panel_session_start';
    var lastVisit = 0;

    function readLastVisit() {
        try {
            var v = sessionStorage.getItem(KEY_SESS);
            if (v !== null) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
        } catch (e) {}
        try {
            var s = localStorage.getItem(KEY_LAST);
            var p = parseInt(s || '0', 10);
            return isNaN(p) ? 0 : p;
        } catch (e) { return 0; }
    }
    function saveLastVisit() {
        try { localStorage.setItem(KEY_LAST, String(Date.now())); } catch (e) {}
    }

    function renderEventLog24h() {
        var list = document.getElementById('event-log-list');
        if (!list) return;
        var data = window.currentData;
        if (!data) return;
        var events = data.event_log || [];
        var now = Date.now();
        var floor = now - 24 * 3600 * 1000;
        var cutoff = lastVisit > 0 ? Math.max(lastVisit, floor) : floor;
        var fresh = [];
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (e && typeof e.ts === 'number' && e.ts > cutoff) fresh.push(e);
        }
        if (fresh.length === 0) {
            list.innerHTML = '<div class="event-log-empty">За последние сутки событий не было.<br><small>Полная летопись — во вкладке Хроники.</small></div>';
            ensureMoreLink(list);
            return;
        }
        var lim = Math.min(fresh.length, 12);
        var html = '';
        for (var j = 0; j < lim; j++) {
            var ev = fresh[j];
            html += '<div class="event-log-item event-type-' + (ev.type || 'info') + '">' +
                '<div class="event-log-icon">' + escapeHtml(ev.icon || '•') + '</div>' +
                '<div class="event-log-body">' +
                    '<div class="event-log-msg">' + escapeHtml(ev.message || '') + '</div>' +
                    '<div class="event-log-time">' + timeAgo(ev.ts) + '</div>' +
                '</div>' +
            '</div>';
        }
        if (fresh.length > 12) {
            html += '<div class="event-log-empty" style="padding:10px 8px">и ещё ' + (fresh.length - 12) + '</div>';
        }
        list.innerHTML = html;
        ensureMoreLink(list);
        /* v1.1: точечная замена */
        replaceEmojisInElement(list);
    }

    /* v1.1: SVG-иконки вместо 📜 и → */
    function ensureMoreLink(list) {
        if (!list) return;
        var next = list.nextElementSibling;
        if (next && next.classList.contains('event-log-more')) {
            var existingLink = next.querySelector('#event-log-more-link');
            if (existingLink) decorateMoreLink(existingLink);
            return;
        }
        var wrap = document.createElement('div');
        wrap.className = 'event-log-more';
        var a = document.createElement('a');
        a.href = '#';
        a.id = 'event-log-more-link';
        decorateMoreLink(a);
        a.addEventListener('click', function (ev) {
            ev.preventDefault();
            var btn = document.querySelector('.main-nav .nav-btn[data-tab="chronicles"]');
            if (btn) btn.click();
        });
        wrap.appendChild(a);
        if (list.nextSibling) list.parentNode.insertBefore(wrap, list.nextSibling);
        else list.parentNode.appendChild(wrap);
    }

    function decorateMoreLink(a) {
        if (!a) return;
        a.innerHTML = '';
        if (window.PanelIcons && window.PanelIcons.element) {
            var svg1 = window.PanelIcons.element('scroll', 14);
            if (svg1) a.appendChild(svg1);
            a.appendChild(document.createTextNode(' Полная летопись '));
            var svg2 = window.PanelIcons.element('arrowright', 14);
            if (svg2) a.appendChild(svg2);
        } else {
            a.textContent = 'Полная летопись';
        }
    }

    /* ============================================================
       11. CHRONICLES
       ============================================================ */
    var ICON_BY_TYPE = {
        war_declared:'⚔️', war_ended:'🏆', capitulation:'🕊️',
        capital_captured:'🔥', npc_capital_captured:'🔥', capital_set:'🏛️',
        country_created:'🏛️', country_deleted:'🗑️', country_renamed:'✏️',
        pact_signed:'🤝', jackpot_won:'💎', big_win:'💰', court_verdict:'⚖️',
        event_started:'🎁', event_ended:'🎁', event_winner:'🏆', boss_killed:'☠️'
    };
    var FILTER_MAP = {
        war:       ['war_declared', 'war_ended', 'capitulation', 'capital_captured', 'npc_capital_captured'],
        country:   ['country_created', 'country_deleted', 'country_renamed', 'capital_set'],
        diplomacy: ['pact_signed', 'court_verdict'],
        event:     ['event_started', 'event_ended', 'event_winner', 'boss_killed']
    };
    var MONTHS_RU = ['января','февраля','марта','апреля','мая','июня',
                     'июля','августа','сентября','октября','ноября','декабря'];
    var chroniclesFilter = 'all';

    function chroniclesFilterClass(type) {
        if (FILTER_MAP.war.indexOf(type) !== -1) return 'chr-war';
        if (FILTER_MAP.country.indexOf(type) !== -1) return 'chr-country';
        if (FILTER_MAP.diplomacy.indexOf(type) !== -1) return 'chr-diplomacy';
        if (FILTER_MAP.event.indexOf(type) !== -1) return 'chr-event';
        return 'chr-other';
    }
    function chroniclesMatchesFilter(type, filter) {
        if (filter === 'all') return true;
        var list = FILTER_MAP[filter];
        if (!list) return true;
        return list.indexOf(type) !== -1;
    }
    function chroniclesDayKey(d) {
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    function chroniclesDayLabel(date) {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var diff = Math.round((today - d) / 86400000);
        if (diff === 0) return 'Сегодня, ' + d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
        if (diff === 1) return 'Вчера, ' + d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
        if (diff < 7) return diff + ' дн назад, ' + d.getDate() + ' ' + MONTHS_RU[d.getMonth()];
        return d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
    }

    function renderChronicles() {
        var feed = document.getElementById('chr-feed');
        if (!feed) return;
        var data = window.currentData;
        if (!data) { feed.innerHTML = '<div class="chr-empty">Загрузка летописи…</div>'; return; }
        var events = data.event_log || [];
        if (events.length === 0) {
            feed.innerHTML = '<div class="chr-empty">Летопись пуста.</div>';
            return;
        }
        var filtered = events.filter(function (e) { return chroniclesMatchesFilter(e.type, chroniclesFilter); });
        if (filtered.length === 0) {
            feed.innerHTML = '<div class="chr-empty">По этому фильтру ничего нет.</div>';
            return;
        }
        var groups = {};
        filtered.forEach(function (e) {
            var d = new Date(e.ts);
            var key = chroniclesDayKey(d);
            if (!groups[key]) groups[key] = { date: d, events: [] };
            groups[key].events.push(e);
        });
        var sorted = Object.keys(groups).map(function (k) { return groups[k]; })
            .sort(function (a, b) { return b.date - a.date; });
        var html = '';
        sorted.forEach(function (g) {
            html += '<div class="chr-day">';
            html += '<div class="chr-day-header"><span class="chr-day-label">' +
                    escapeHtml(chroniclesDayLabel(g.date)) + '</span></div>';
            html += '<div class="chr-events">';
            g.events.sort(function (a, b) { return b.ts - a.ts; });
            g.events.forEach(function (e) {
                var type = e.type || 'info';
                var cls = chroniclesFilterClass(type);
                var icon = ICON_BY_TYPE[type] || e.icon || '•';
                var d = new Date(e.ts);
                var time = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
                html += '<div class="chr-event ' + cls + '">' +
                    '<div class="chr-event-icon">' + escapeHtml(icon) + '</div>' +
                    '<div class="chr-event-body">' +
                        '<div class="chr-event-msg">' + escapeHtml(e.message || '') + '</div>' +
                        '<div class="chr-event-time">' + escapeHtml(time) + '</div>' +
                    '</div>' +
                '</div>';
            });
            html += '</div></div>';
        });
        feed.innerHTML = html;
        /* v1.1: заменить эмодзи в иконках и тексте */
        replaceEmojisInElement(feed);
    }

    function installChroniclesFilters() {
        var wrap = document.getElementById('chr-filters');
        if (!wrap || wrap.dataset.perfInit === '1') return;
        wrap.dataset.perfInit = '1';
        wrap.addEventListener('click', function (e) {
            var btn = e.target.closest('.chr-filter');
            if (!btn) return;
            chroniclesFilter = btn.dataset.filter || 'all';
            var all = wrap.querySelectorAll('.chr-filter');
            for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
            renderChronicles();
        });
    }

    /* ============================================================
       12. ACTIVE WARS
       ============================================================ */
    function pluralDays(n) {
        var m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return n + ' день';
        if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return n + ' дня';
        return n + ' дней';
    }
    function ensureWarsPanel() {
        if (document.getElementById('active-wars-panel')) return;
        var topCountries = document.querySelector('#tab-overview .overview-main > .panel:nth-of-type(2)');
        if (!topCountries) return;
        var panel = document.createElement('section');
        panel.id = 'active-wars-panel';
        panel.className = 'panel active-wars-panel';
        panel.style.display = 'none';
        panel.innerHTML =
            '<div class="panel-header"><h2 data-icon="war">Активные войны</h2></div>' +
            '<div class="active-wars-list" id="active-wars-list"></div>';
        topCountries.parentNode.insertBefore(panel, topCountries);
        if (window.PanelIcons && window.PanelIcons.autoReplace) window.PanelIcons.autoReplace(panel);
    }
    function renderActiveWars() {
        ensureWarsPanel();
        var panel = document.getElementById('active-wars-panel');
        var list = document.getElementById('active-wars-list');
        if (!panel || !list) return;
        var data = window.currentData;
        if (!data) return;
        var wars = data.wars || [];
        if (wars.length === 0) {
            panel.style.display = 'none';
            list.innerHTML = '';
            return;
        }
        panel.style.display = 'block';
        var iconHtml = (window.PanelIcons && window.PanelIcons.element)
            ? (function () {
                var svg = window.PanelIcons.element('war', 20);
                return svg ? svg.outerHTML : '';
            })() : '';
        var html = '';
        for (var i = 0; i < wars.length; i++) {
            var w = wars[i];
            var attacker = w.attacker || '?';
            var defender = w.defender || '?';
            var duration = pluralDays(w.duration_days || 0);
            html += '<div class="aw-item" onclick="if(typeof openCountryPassport===\'function\')openCountryPassport(\'' +
                    escapeAttr(attacker) + '\')">' +
                '<div class="aw-icon">' + iconHtml + '</div>' +
                '<div class="aw-body">' +
                    '<div class="aw-title"><b>' + escapeHtml(attacker) + '</b> против <b>' +
                        escapeHtml(defender) + '</b></div>' +
                    '<div class="aw-meta">Идёт уже ' + duration + '</div>' +
                '</div>' +
                '<div class="aw-duration">' + duration + '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    /* ============================================================
       13. WORLD TIMELINE
       ============================================================ */
    function ensureTimeline() {
        if (document.getElementById('world-timeline')) return;
        var chartPanel = document.getElementById('panel-online-chart');
        if (!chartPanel) return;
        var sparkline = chartPanel.querySelector('.sparkline-wrap');
        if (!sparkline) return;
        var wrap = document.createElement('div');
        wrap.id = 'world-timeline';
        wrap.className = 'world-timeline';
        wrap.innerHTML =
            '<div class="world-timeline-header">' +
                '<div class="world-timeline-title" data-icon="scroll">Летопись 24 часов</div>' +
                '<div class="world-timeline-hint">Наведите на точку</div>' +
            '</div>' +
            '<div class="world-timeline-canvas-wrap">' +
                '<canvas class="world-timeline-canvas" id="world-timeline-canvas"></canvas>' +
            '</div>';
        sparkline.parentNode.insertBefore(wrap, sparkline.nextSibling);
        if (window.PanelIcons && window.PanelIcons.autoReplace) window.PanelIcons.autoReplace(wrap);
    }
    var TL_COLORS = {
        war_declared:'#B83A2E', war_ended:'#52682A', capitulation:'#7A9048',
        capital_captured:'#D04040', capital_set:'#A88A48',
        country_created:'#52682A', country_deleted:'#8B2020',
        pact_signed:'#5A8CB4', jackpot_won:'#C040A0',
        event_started:'#8A4AA8', boss_killed:'#6A3F1E'
    };
    function renderTimeline() {
        ensureTimeline();
        var canvas = document.getElementById('world-timeline-canvas');
        if (!canvas) return;
        var data = window.currentData;
        if (!data) return;
        var wrap = canvas.parentElement;
        var dpr = window.devicePixelRatio || 1;
        var w = wrap.clientWidth || 800;
        var h = wrap.clientHeight || 56;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var now = Date.now(), start = now - 24 * 3600 * 1000;
        ctx.strokeStyle = 'rgba(168, 138, 72, 0.25)';
        ctx.lineWidth = 1;
        for (var i = 0; i <= 8; i++) {
            var px = (i / 8) * w;
            ctx.beginPath(); ctx.moveTo(px, 12); ctx.lineTo(px, h - 12); ctx.stroke();
            var t = new Date(start + i * (24 * 3600 * 1000 / 8));
            ctx.fillStyle = 'rgba(168, 138, 72, 0.7)';
            ctx.font = "10px 'IM Fell English', Georgia, serif";
            ctx.textAlign = i === 0 ? 'left' : (i === 8 ? 'right' : 'center');
            ctx.fillText(pad2(t.getHours()) + ':00', px, h - 2);
        }
        var events = (data.event_log || []).filter(function (e) { return e && e.ts >= start && e.ts <= now; });
        for (var j = 0; j < events.length; j++) {
            var e = events[j];
            var x = ((e.ts - start) / (24 * 3600 * 1000)) * w;
            var color = TL_COLORS[e.type] || '#8A7558';
            var freshness = 1 - (now - e.ts) / (24 * 3600 * 1000);
            var radius = 3 + freshness * 3;
            ctx.beginPath();
            ctx.arc(x, h / 2, radius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = color + '22';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, h / 2, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        if (events.length === 0) {
            ctx.fillStyle = 'rgba(168, 138, 72, 0.6)';
            ctx.font = "italic 12px 'EB Garamond', Georgia, serif";
            ctx.textAlign = 'center';
            ctx.fillText('За последние 24 часа событий не было', w / 2, h / 2 + 4);
        }
    }

    /* ============================================================
       14. BOOT
       ============================================================ */
    function boot() {
        lastVisit = readLastVisit();
        try {
            if (!sessionStorage.getItem(KEY_SESS)) {
                sessionStorage.setItem(KEY_SESS, String(lastVisit || Date.now()));
            }
        } catch (e) {}

        window.renderCountries = renderCountries;
        window.renderPlayers = renderPlayers;
        window.renderEventLog = renderEventLog24h;

        var initial = function () {
            injectStatSvgs();
            renderCountries();
            renderPlayers();
            renderCards();
            renderEventLog24h();
            ensureWarsPanel();
            renderActiveWars();
            ensureTimeline();
            renderTimeline();
            if (isTabActive('chronicles')) renderChronicles();
            replaceEmojisInVisibleTab();
        };
        setTimeout(initial, 600);
        setTimeout(initial, 1600);

        ticker.subscribe(function () {
            setTimeout(function () {
                renderCountries();
                renderPlayers();
                renderCards();
                renderEventLog24h();
                renderActiveWars();
                if (isTabActive('home')) renderTimeline();
            }, 200);
        });
        ticker.start();

        /* Observer'ы — узкие, на конкретные контейнеры */
        observer.add('countries-body', document.getElementById('countries-body'), function () {
            renderCards();
        }, 100);
        observer.add('event-log-list', document.getElementById('event-log-list'), function () {
            replaceEmojisInElement(document.getElementById('event-log-list'));
        }, 200);

        /* v1.1: гайд грузится через fetch — обход нужен после вставки HTML */
        observer.add('guide-content', document.getElementById('guide-content'), function () {
            var gc = document.getElementById('guide-content');
            if (gc) replaceEmojisInElement(gc);
        }, 200);

        /* v1.1: модалки — панели игрока и паспорт страны */
        observer.add('player-modal-panels', document.getElementById('player-modal-panels'), function () {
            var el = document.getElementById('player-modal-panels');
            if (el) replaceEmojisInElement(el);
        }, 150);
        observer.add('pp-body', document.getElementById('pp-body'), function () {
            var el = document.getElementById('pp-body');
            if (el) replaceEmojisInElement(el);
        }, 150);

        /* v1.1: кнопки rotate в player-modal (▶/⏸) */
        observer.add('player-viewer-controls', document.querySelector('.player-viewer-controls'), function () {
            var el = document.querySelector('.player-viewer-controls');
            if (el) replaceEmojisInElement(el);
        }, 150);

        installChroniclesFilters();

        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.nav-btn, .bn-btn');
            if (!btn) return;
            var tab = btn.dataset.tab;
            setTimeout(function () {
                if (tab === 'chronicles') renderChronicles();
                if (tab === 'home') renderTimeline();
                if (tab === 'countries') injectSparklines();
                if (tab === 'players') refreshAvatars();
                replaceEmojisInVisibleTab();
            }, 80);
        });

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                saveLastVisit();
                ticker.suspend();
            } else {
                ticker.resume();
                renderTimeline();
            }
        });

        setTimeout(refreshAvatars, 3000);
        setTimeout(refreshAvatars, 6000);

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (isTabActive('home')) renderTimeline();
            }, 250);
        }, { passive: true });

        console.log('[PerfBundle] v1.1 ready — SVG-safe emoji replace, guide observer');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    window.PanelAvatars = {
        get: getAvatar,
        svg: makeSvgAvatar,
        refresh: refreshAvatars
    };
    window.CountryCards = { refresh: renderCards, injectSvgs: injectStatSvgs };
    window.PanelDetail = { refresh: function () { injectStatSvgs(); renderCountries(); renderPlayers(); } };
    window.PanelEmojiReplacer = { refresh: replaceEmojisInVisibleTab, map: EMOJI_MAP };
    window.Chronicles = { refresh: renderChronicles };
    window.ActiveWars = { refresh: renderActiveWars };
    window.EventLog24h = { refresh: renderEventLog24h };
    window.WorldTimeline = { refresh: renderTimeline };
    window.CountrySparkline = { refresh: injectSparklines };
    window.PerfBundle = {
        ticker: ticker,
        refreshAll: function () {
            injectStatSvgs();
            renderCountries();
            renderPlayers();
            renderCards();
            renderEventLog24h();
            renderActiveWars();
            renderTimeline();
            if (isTabActive('chronicles')) renderChronicles();
            replaceEmojisInVisibleTab();
        },
        stats: function () {
            return { subs: ticker.subs.length, observers: observer.jobs.length, suspended: ticker.suspended };
        }
    };
})();
