/* Sovereignty panel v2.8 — панели в стиле сайта */

const DATA_URL = 'data/server1.json';
const MAP_URL = 'data/map.png';
const LOCAL_SKIN_DIR = 'data/skins/';
const SKIN_API = 'https://mc-heads.net';
const CRAFATAR = 'https://crafatar.com';
const STEVE_UUID = '8667ba71-b85a-4004-af54-457a9734eed7';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const BLOCKS_PER_CHUNK = 16;
const PIXELS_PER_BLOCK = 2;
const SKIN_CAMERA_TARGET_Y = 16;
const SKIN_CAMERA_DISTANCE = 50;
const SKIN_CAMERA_FOV = 45;
const SKIN_LIGHT_INTENSITY = 1.2;
const MARKER_BASE_PX = 32;
const MARKER_MIN_PX = 18;
const MARKER_MAX_PX = 72;
const MARKER_GROWTH_POWER = 0.5;

let currentData = null;
let currentSort = 'claims';
let mapZoom = 1, mapOffsetX = 0, mapOffsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0, dragMoved = false;
let highlightedCountry = null;
let showPlayerMarkers = true;
let mapImage = null, mapCanvas = null, mapCtx = null, mapReady = false;
let currentSkinViewer = null, currentRotateAnim = null, rotatePaused = false;

const PALETTE = ['#6366f1','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6','#a855f7','#f43f5e','#22d3ee','#a3e635','#facc15','#fb923c','#e879f9','#4ade80','#60a5fa','#fca5a5'];

document.addEventListener('DOMContentLoaded', () => {
    try {
        initTabs();
        initSortTabs();
        initMapControls();
        initCommandCopy();
        initGuideNav();
        initCommandSearch();
        initPlayerControls();
        initModalControls();
        const rb = document.getElementById('refresh-btn');
        if (rb) rb.onclick = () => { loadData(); loadMap(); };
        loadData();
        setInterval(loadData, REFRESH_INTERVAL_MS);
    } catch (e) { console.error('[Sovereignty] init error:', e); }
});

function initTabs() {
    document.querySelectorAll('.main-nav .nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const t = document.getElementById('tab-' + tab);
            if (t) t.classList.add('active');
            if (tab === 'map' && mapReady) setTimeout(resetMapView, 50);
        });
    });
}

function initSortTabs() {
    document.querySelectorAll('.tab[data-sort]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab[data-sort]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSort = tab.dataset.sort;
            renderCountries();
        });
    });
}

function initModalControls() {
    document.querySelectorAll('[data-modal-close]').forEach(el => {
        el.addEventListener('click', () => closePlayerModal());
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePlayerModal(); });
    const rotBtn = document.getElementById('skin-toggle-rotate');
    if (rotBtn) rotBtn.onclick = () => {
        rotatePaused = !rotatePaused;
        rotBtn.textContent = rotatePaused ? '▶ Пуск' : '⏸ Пауза';
        rotBtn.classList.toggle('active', rotatePaused);
    };
    const resetBtn = document.getElementById('skin-reset-view');
    if (resetBtn) resetBtn.onclick = () => { if (currentSkinViewer) applyDefaultCamera(currentSkinViewer); };
    const nameBtn = document.getElementById('skin-toggle-name');
    if (nameBtn) nameBtn.onclick = () => {
        if (currentSkinViewer && currentSkinViewer.nameTag)
            currentSkinViewer.nameTag.visible = !currentSkinViewer.nameTag.visible;
    };
}

function openPlayerModal() {
    document.getElementById('player-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
    document.getElementById('player-modal').classList.remove('show');
    document.body.style.overflow = '';
    if (currentSkinViewer) { try { currentSkinViewer.dispose(); } catch (e) {} currentSkinViewer = null; }
    currentRotateAnim = null;
    rotatePaused = false;
    const btn = document.getElementById('skin-toggle-rotate');
    if (btn) { btn.textContent = '⏸ Пауза'; btn.classList.remove('active'); }
}

async function loadData() {
    const tbody = document.getElementById('countries-body');
    if (tbody && tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">⏳ Загрузка данных...</td></tr>';
    }
    try {
        const r = await fetch(DATA_URL + '?t=' + Date.now());
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const text = await r.text();
        if (!text || !text.trim()) throw new Error('Пустой файл');
        currentData = JSON.parse(text);
        render();
        loadMap();
    } catch (err) {
        console.error('[Sovereignty] load error:', err);
        const sn = document.getElementById('server-name');
        if (sn) sn.textContent = '⚠ Ошибка';
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="loading" style="color:#ef4444;">❌ ' + escapeHtml(err.message) + '</td></tr>';
    }
}

function render() {
    if (!currentData) return;
    const sn = document.getElementById('server-name');
    if (sn) sn.textContent = currentData.server_name || 'Сервер';
    const ob = document.getElementById('online-badge');
    if (ob) ob.textContent = 'Онлайн: ' + (currentData.online_players || 0) + ' / ' + (currentData.max_players || 0);
    const upd = currentData.updated_at;
    if (upd) {
        const m = Math.floor((Date.now() - upd) / 60000);
        const ago = m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : Math.floor(m / 60) + ' ч назад';
        const ub = document.getElementById('updated-badge');
        if (ub) ub.textContent = 'Обновлено: ' + ago;
    }
    const countries = currentData.countries || [];
    const players = currentData.players || [];
    setText('countries-count', countries.length);
    setText('total-claims', countries.reduce((s, c) => s + (c.claims || 0), 0).toLocaleString('ru-RU'));
    setText('total-bank', formatMoney(countries.reduce((s, c) => s + (c.bank || 0), 0)));
    setText('total-energy', countries.reduce((s, c) => s + (c.energy || 0), 0).toFixed(1));
    const tp = document.getElementById('total-players');
    if (tp) {
        if (players.length > 0) {
            const online = players.filter(p => p.online).length;
            tp.textContent = online > 0 ? online + ' / ' + players.length : String(players.length);
        } else {
            tp.textContent = String(currentData.online_players || 0);
        }
    }
    renderCountries();
    renderLegend();
    renderPlayers();
    renderBonus();
    renderPlayerMarkers();
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderCountries() {
    if (!currentData) return;
    const countries = [...(currentData.countries || [])];
    countries.sort((a, b) => {
        switch (currentSort) {
            case 'bank': return (b.bank || 0) - (a.bank || 0);
            case 'energy': return (b.energy || 0) - (a.energy || 0);
            case 'allies': return (b.allies || 0) - (a.allies || 0);
            default: return (b.claims || 0) - (a.claims || 0);
        }
    });
    const tbody = document.getElementById('countries-body');
    if (!tbody) return;
    if (countries.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="loading">Пока нет стран.</td></tr>'; return; }
    tbody.innerHTML = countries.map((c, i) => {
        const rc = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
        return '<tr class="' + rc + '" onclick="showDetails(\'' + escapeAttr(c.name) + '\')">' +
            '<td class="rank">#' + (i + 1) + '</td>' +
            '<td class="name">' + escapeHtml(c.name || '?') + '</td>' +
            '<td>' + escapeHtml(c.owner || '?') + '</td>' +
            '<td>' + (c.claims || 0) + ' / ' + (c.max_claims || '?') + '</td>' +
            '<td class="money">' + formatMoney(c.bank || 0) + '</td>' +
            '<td class="energy">' + (c.energy || 0).toFixed(1) + '</td>' +
            '<td>' + (c.allies || 0) + '</td>' +
            '<td>' + (c.pacts || 0) + '</td></tr>';
    }).join('');
}

function renderLegend() {
    const legend = document.getElementById('map-legend');
    if (!legend) return;
    const countries = currentData && currentData.countries ? currentData.countries : [];
    if (countries.length === 0) { legend.innerHTML = ''; return; }
    legend.innerHTML = countries.map((c, i) =>
        '<div class="legend-item" data-country="' + escapeAttr(c.name) + '" onclick="highlightCountry(\'' + escapeAttr(c.name) + '\')">' +
        '<div class="legend-color" style="background:' + PALETTE[i % PALETTE.length] + '"></div>' +
        '<span>' + escapeHtml(c.name) + '</span></div>'
    ).join('');
}

function highlightCountry(name) {
    highlightedCountry = highlightedCountry === name ? null : name;
    document.querySelectorAll('.legend-item').forEach(el => {
        el.classList.toggle('highlight', el.dataset.country === highlightedCountry);
    });
    if (highlightedCountry) showDetails(highlightedCountry);
}

function showDetails(countryName) {
    const countries = currentData && currentData.countries ? currentData.countries : [];
    const country = countries.find(c => c.name === countryName);
    if (!country) return;
    const dt = document.getElementById('detail-title');
    if (dt) dt.textContent = '🏛️ ' + country.name;
    const content = document.getElementById('detail-content');
    if (!content) return;
    const items = [
        { label: 'Лидер', value: country.owner || '?' },
        { label: 'Территория', value: (country.claims || 0) + ' / ' + (country.max_claims || '?') + ' чанков' },
        { label: 'Казна', value: formatMoney(country.bank || 0), cls: 'success' },
        { label: 'Долг', value: formatMoney(country.debt || 0), cls: (country.debt || 0) > 0 ? 'danger' : '' },
        { label: 'Энергия', value: (country.energy || 0).toFixed(1) + ' / ' + (country.max_energy || 0).toFixed(1), cls: 'warning' },
        { label: 'Регенерация', value: (country.regen || 0).toFixed(1) + '/час', cls: 'warning' },
        { label: 'Уровень ферм', value: country.farm_level || 0 },
        { label: 'Союзы', value: country.allies || 0 },
        { label: 'Пакты', value: country.pacts || 0 },
        { label: '🌾 Ферм', value: country.chunks_farm || 0 },
        { label: '⛏ Шахт', value: country.chunks_mining || 0 },
        { label: '⚔ Военных', value: country.chunks_military || 0 },
        { label: '💰 Торговых', value: country.chunks_trade || 0 }
    ];
    content.innerHTML = items.map(it =>
        '<div class="detail-item"><div class="label">' + it.label + '</div>' +
        '<div class="value ' + (it.cls || '') + '">' + escapeHtml(String(it.value)) + '</div></div>'
    ).join('');
    const cd = document.getElementById('country-details');
    if (cd) { cd.style.display = 'block'; cd.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function loadMap() {
    const ph = document.getElementById('map-placeholder');
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const first = !mapReady;
        mapImage = img;
        setupCanvas(img.naturalWidth, img.naturalHeight);
        mapReady = true;
        if (ph) ph.style.display = 'none';
        canvas.style.display = 'block';
        if (first) setTimeout(resetMapView, 50);
        else applyMapTransform();
        renderPlayerMarkers();
    };
    img.onerror = () => {
        mapReady = false;
        canvas.style.display = 'none';
        if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div class="map-placeholder-icon">🗺️</div><p>Карта не сгенерирована.</p>'; }
    };
    img.src = MAP_URL + '?t=' + Date.now();
}

function setupCanvas(w, h) {
    const canvas = document.getElementById('map-canvas');
    canvas.width = w; canvas.height = h;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    mapCanvas = canvas;
    mapCtx = canvas.getContext('2d', { willReadFrequently: true });
    mapCtx.drawImage(mapImage, 0, 0);
}

function initMapControls() {
    const vp = document.getElementById('map-viewport');
    if (!vp) return;
    vp.addEventListener('mousedown', e => {
        if (!mapReady || e.target.closest('.map-marker')) return;
        isDragging = true; dragMoved = false;
        dragStartX = e.clientX - mapOffsetX;
        dragStartY = e.clientY - mapOffsetY;
    });
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        const nx = e.clientX - dragStartX, ny = e.clientY - dragStartY;
        if (Math.abs(nx - mapOffsetX) > 3 || Math.abs(ny - mapOffsetY) > 3) dragMoved = true;
        mapOffsetX = nx; mapOffsetY = ny;
        applyMapTransform();
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    vp.addEventListener('click', e => {
        if (!mapReady || dragMoved || e.target.closest('.map-marker')) return;
        handleMapClick(e);
    });
    vp.addEventListener('wheel', e => {
        if (!mapReady) return;
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        const ix = (cx - mapOffsetX) / mapZoom, iy = (cy - mapOffsetY) / mapZoom;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        mapZoom = Math.max(0.1, Math.min(12, mapZoom * delta));
        mapOffsetX = cx - ix * mapZoom;
        mapOffsetY = cy - iy * mapZoom;
        applyMapTransform();
    }, { passive: false });
    const rb = document.getElementById('map-reset');
    if (rb) rb.addEventListener('click', resetMapView);
    const cb = document.getElementById('map-clear-highlight');
    if (cb) cb.addEventListener('click', () => {
        highlightedCountry = null;
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('highlight'));
        const cd = document.getElementById('country-details');
        if (cd) cd.style.display = 'none';
    });
    const sp = document.getElementById('map-show-players');
    if (sp) sp.addEventListener('change', () => { showPlayerMarkers = sp.checked; renderPlayerMarkers(); });
}

function handleMapClick(e) {
    const vp = document.getElementById('map-viewport');
    const rect = vp.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const ix = Math.round((cx - mapOffsetX) / mapZoom);
    const iy = Math.round((cy - mapOffsetY) / mapZoom);
    if (ix < 0 || iy < 0 || ix >= mapCanvas.width || iy >= mapCanvas.height) return;
    let px;
    try { px = mapCtx.getImageData(ix, iy, 1, 1).data; } catch (err) { return; }
    const a = px[3];
    if (a < 10) return;
    const countries = currentData && currentData.countries ? currentData.countries : [];
    let bestIdx = -1, bestDist = 120;
    countries.forEach((c, i) => {
        const rgb = hexToRgb(PALETTE[i % PALETTE.length]);
        const d = Math.sqrt(Math.pow(px[0] - rgb[0], 2) + Math.pow(px[1] - rgb[1], 2) + Math.pow(px[2] - rgb[2], 2));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx === -1) return;
    const country = countries[bestIdx];
    highlightCountry(country.name);
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    const ov = document.querySelector('.main-nav .nav-btn[data-tab="overview"]');
    if (ov) ov.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const ovTab = document.getElementById('tab-overview');
    if (ovTab) ovTab.classList.add('active');
    showDetails(country.name);
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function applyMapTransform() {
    const canvas = document.getElementById('map-canvas');
    const overlay = document.getElementById('map-overlay');
    if (!canvas) return;
    const t = 'translate(' + mapOffsetX + 'px,' + mapOffsetY + 'px) scale(' + mapZoom + ')';
    canvas.style.transform = t;
    if (overlay) { overlay.style.transform = t; updateMarkerScale(); }
}

function updateMarkerScale() {
    const overlay = document.getElementById('map-overlay');
    if (!overlay) return;
    const z = Math.max(0.05, mapZoom);
    const desired = MARKER_BASE_PX * Math.pow(z, MARKER_GROWTH_POWER);
    const clamped = Math.max(MARKER_MIN_PX, Math.min(MARKER_MAX_PX, desired));
    const counter = clamped / (MARKER_BASE_PX * z);
    overlay.style.setProperty('--marker-counter', counter.toFixed(4));
}

function resetMapView() {
    const canvas = document.getElementById('map-canvas');
    const vp = document.getElementById('map-viewport');
    if (!canvas || !vp || !mapReady) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const iw = mapCanvas.width, ih = mapCanvas.height;
    const scale = Math.min(vw / iw, vh / ih) * 0.98;
    mapZoom = scale;
    mapOffsetX = (vw - iw * scale) / 2;
    mapOffsetY = (vh - ih * scale) / 2;
    applyMapTransform();
}

function worldToImagePx(x, z, meta) {
    const minBX = meta.min_chunk_x * BLOCKS_PER_CHUNK;
    const minBZ = meta.min_chunk_z * BLOCKS_PER_CHUNK;
    return { px: (x - minBX) * PIXELS_PER_BLOCK, pz: (z - minBZ) * PIXELS_PER_BLOCK };
}

function renderPlayerMarkers() {
    const overlay = document.getElementById('map-overlay');
    if (!overlay) return;
    if (!showPlayerMarkers || !mapReady || !currentData) { overlay.innerHTML = ''; return; }
    const meta = currentData.map_meta;
    const players = currentData.players || [];
    if (!meta || players.length === 0) { overlay.innerHTML = ''; return; }
    const markers = [];
    for (const p of players) {
        const pos = p.position;
        if (!pos || pos.x == null || pos.z == null) continue;
        if (pos.world && meta.world && pos.world !== meta.world) continue;
        const pt = worldToImagePx(pos.x, pos.z, meta);
        if (pt.px < 0 || pt.pz < 0 || pt.px > mapCanvas.width || pt.pz > mapCanvas.height) continue;
        const online = !!p.online;
        const name = p.name || '?';
        const headUrl = SKIN_API + '/avatar/' + encodeURIComponent(name) + '/32';
        const fallback = SKIN_API + '/avatar/Steve/32';
        markers.push('<div class="map-marker ' + (online ? 'online' : '') + '" style="left:' + pt.px + 'px;top:' + pt.pz + 'px;" onclick="openPlayer(\'' + escapeAttr(name) + '\');event.stopPropagation();" title="' + escapeAttr(name) + '">' +
            '<div class="map-marker-content">' +
            '<img class="map-marker-head" src="' + headUrl + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
            '<div class="map-marker-label">' + escapeHtml(name) + '</div></div></div>');
    }
    overlay.innerHTML = markers.join('');
    updateMarkerScale();
}

function initPlayerControls() {
    const s = document.getElementById('player-search');
    if (s) s.addEventListener('input', () => renderPlayers());
    const o = document.getElementById('player-online-only');
    if (o) o.addEventListener('change', () => renderPlayers());
}

function renderPlayers() {
    const grid = document.getElementById('players-grid');
    const empty = document.getElementById('players-empty');
    if (!grid || !empty) return;
    const players = currentData && currentData.players ? currentData.players : null;
    if (!players || players.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    const q = (document.getElementById('player-search').value || '').trim().toLowerCase();
    const onlineOnly = document.getElementById('player-online-only').checked || false;
    let filtered = [...players];
    if (q) filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(q) || (p.country || '').toLowerCase().includes(q));
    if (onlineOnly) filtered = filtered.filter(p => p.online);
    filtered.sort((a, b) => {
        if (!!b.online !== !!a.online) return b.online ? 1 : -1;
        return (b.playtime_seconds || 0) - (a.playtime_seconds || 0);
    });
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">Ничего не найдено.</div>';
        return;
    }
    grid.innerHTML = filtered.map(p => renderPlayerCard(p)).join('');
}

function renderPlayerCard(p) {
    const name = p.name || '?';
    const avatar = SKIN_API + '/avatar/' + encodeURIComponent(name) + '/64';
    const fallback = SKIN_API + '/avatar/Steve/64';
    const online = !!p.online;
    let badge = '';
    if (p.country_role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
    else if (p.country_role === 'co_ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';
    const pt = formatPlaytime(p.playtime_seconds);
    const money = p.balance != null ? formatMoney(p.balance) : null;
    return '<div class="player-card" onclick="openPlayer(\'' + escapeAttr(name) + '\')">' +
        badge +
        '<div class="player-card-avatar">' +
        '<img src="' + avatar + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
        '<div class="status-dot ' + (online ? 'online' : 'offline') + '"></div></div>' +
        '<div class="player-card-info">' +
        '<div class="player-card-name">' + escapeHtml(name) + '</div>' +
        '<div class="player-card-country">' + (p.country ? '<span class="country-tag">🏛️ ' + escapeHtml(p.country) + '</span>' : '<span class="no-country">Без страны</span>') + '</div>' +
        '<div class="player-card-meta">' +
        (money != null ? '<span class="money">💰 ' + money + '</span>' : '') +
        (pt ? '<span>⏱ ' + pt + '</span>' : '') +
        '</div></div></div>';
}

// ==================== PLAYER PANEL RENDERERS ====================

function renderPanel(title, rows) {
    const valid = (rows || []).filter(r => r.value !== undefined && r.value !== null && r.value !== '');
    if (valid.length === 0) return '';
    return '<div class="player-panel">' +
        '<div class="player-panel-title">' + escapeHtml(title) + '</div>' +
        valid.map(r => renderPanelRow(r)).join('') +
        '</div>';
}

function renderPanelRow(r) {
    const copyBtn = r.copy
        ? '<button class="player-copy-btn" onclick="copyToClipboardSafe(\'' + escapeAttr(r.copy) + '\')" title="Скопировать">📋 Копировать</button>'
        : '';
    return '<div class="player-panel-row">' +
        '<div class="row-label">' + escapeHtml(r.label) + '</div>' +
        '<div class="row-value ' + (r.cls || '') + '">' + escapeHtml(String(r.value)) + '</div>' +
        copyBtn +
        '</div>';
}

// ==================== PLAYER MODAL ====================

function openPlayer(name) {
    const players = currentData && currentData.players ? currentData.players : [];
    const player = players.find(p => p.name === name);
    if (!player) return;
    const online = !!player.online;
    setText('player-modal-name', name);
    const st = document.getElementById('player-modal-status');
    if (st) {
        st.textContent = online ? '● Онлайн' : '○ Оффлайн';
        st.className = 'player-modal-status ' + (online ? 'online' : 'offline');
    }

    // Панель «Учётная запись»
    const accountRows = [];
    if (player.uuid) accountRows.push({
        label: 'UUID',
        value: shortenUuid(player.uuid),
        copy: player.uuid
    });
    if (player.first_seen) accountRows.push({
        label: 'Первый вход',
        value: timeAgo(player.first_seen)
    });
    if (player.last_seen) accountRows.push({
        label: 'Был в игре',
        value: timeAgo(player.last_seen)
    });
    if (player.playtime_seconds != null) accountRows.push({
        label: 'Время в игре',
        value: formatPlaytime(player.playtime_seconds)
    });
    if (player.playtime_seconds > 0) accountRows.push({
        label: 'Дней в игре',
        value: Math.floor(player.playtime_seconds / 86400)
    });

    // Панель «Экономика»
    const ecoRows = [];
    if (player.balance != null) ecoRows.push({
        label: 'Баланс',
        value: formatMoney(player.balance),
        cls: 'success'
    });
    if (player.job) ecoRows.push({
        label: 'Профессия',
        value: player.job + (player.job_level ? ' (ур. ' + player.job_level + ')' : '')
    });
    if (player.kills != null || player.deaths != null) {
        const k = player.kills || 0, d = player.deaths || 0;
        const kd = d > 0 ? (k / d).toFixed(2) : k;
        ecoRows.push({ label: 'Убийств', value: k });
        ecoRows.push({ label: 'Смертей', value: d });
        ecoRows.push({ label: 'K/D', value: kd });
    }
    if (player.bounty != null && player.bounty > 0) ecoRows.push({
        label: '💀 Награда',
        value: formatMoney(player.bounty),
        cls: 'danger'
    });

    // Панель «Страна»
    const countryRows = [];
    if (player.country) {
        countryRows.push({
            label: 'Название',
            value: player.country,
            cls: 'accent',
            copy: player.country
        });
        if (player.country_role) {
            const rn = player.country_role === 'leader' ? 'Лидер'
                : player.country_role === 'co_ruler' ? 'Соправитель'
                : player.country_role;
            countryRows.push({ label: 'Роль', value: rn });
        }
        const cd = (currentData.countries || []).find(c => c.name === player.country);
        if (cd) {
            if (cd.bank != null) countryRows.push({ label: 'Казна страны', value: formatMoney(cd.bank) });
            if (cd.claims != null) countryRows.push({ label: 'Территория', value: cd.claims + ' чанков' });
            if (cd.allies != null) countryRows.push({ label: 'Союзы', value: cd.allies });
            if (cd.pacts != null) countryRows.push({ label: 'Пакты', value: cd.pacts });
        }
    } else {
        countryRows.push({ label: 'Страна', value: 'Нет' });
    }

    // Панель «Активность»
    const actRows = [];
    if (player.energy != null) actRows.push({
        label: 'Энергия',
        value: player.energy.toFixed(1) + (player.max_energy != null ? ' / ' + player.max_energy.toFixed(1) : ''),
        cls: 'warning'
    });
    if (player.achievements_count != null) actRows.push({
        label: 'Достижений',
        value: player.achievements_count
    });
    if (player.position) {
        const pos = player.position;
        actRows.push({
            label: 'Локация',
            value: Math.round(pos.x) + ', ' + Math.round(pos.y || 0) + ', ' + Math.round(pos.z)
        });
    }

    const panelsEl = document.getElementById('player-modal-panels');
    if (panelsEl) {
        panelsEl.innerHTML =
            renderPanel('Учётная запись', accountRows) +
            renderPanel('Экономика', ecoRows) +
            renderPanel('Страна', countryRows) +
            renderPanel('Активность', actRows);
    }

    // Кнопки действий
    const actions = [];
    if (player.country) actions.push('<button class="player-modal-btn" onclick="gotoCountry(\'' + escapeAttr(player.country) + '\')">🏛️ Перейти к стране</button>');
    if (player.position) actions.push('<button class="player-modal-btn" onclick="gotoPlayerOnMap(\'' + escapeAttr(name) + '\')">🗺️ На карте</button>');
    actions.push('<button class="player-modal-btn" onclick="copyToClipboardSafe(\'' + escapeAttr(name) + '\')">📋 Скопировать ник</button>');
    const actBtnEl = document.getElementById('player-modal-actions');
    if (actBtnEl) actBtnEl.innerHTML = actions.join('');

    openPlayerModal();
    requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => initSkinViewer(name, player.uuid), 80);
    }));
}

function applyDefaultCamera(viewer) {
    try {
        viewer.fov = SKIN_CAMERA_FOV;
        viewer.camera.position.set(0, SKIN_CAMERA_TARGET_Y, SKIN_CAMERA_DISTANCE);
        viewer.camera.lookAt(0, SKIN_CAMERA_TARGET_Y, 0);
        viewer.controls.target.set(0, SKIN_CAMERA_TARGET_Y, 0);
        viewer.controls.update();
    } catch (e) {}
}

async function initSkinViewer(name, uuid) {
    const canvas = document.getElementById('skin-canvas');
    const wrap = document.getElementById('player-viewer-wrap');
    const loading = document.getElementById('skin-loading');
    if (!canvas || !wrap || !loading) return;
    if (currentSkinViewer) { try { currentSkinViewer.dispose(); } catch (e) {} currentSkinViewer = null; }
    loading.classList.remove('hidden');
    loading.innerHTML = '<div class="spinner"></div><div>Загрузка скина...</div>';
    let waited = 0;
    while (window.__skinview3dStatus === 'loading' && waited < 4000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
    }
    if (typeof skinview3d === 'undefined') {
        loading.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:32px;margin-bottom:8px;">⚠</div><div style="color:#f59e0b;font-weight:600;">skinview3d не загрузился</div></div>';
        return;
    }
    try {
        const size = Math.max(320, Math.round(wrap.clientWidth || 380));
        const viewer = new skinview3d.SkinViewer({ canvas: canvas, width: size, height: size });
        try { viewer.renderer.setClearColor(0x000000, 0); } catch (e) {}
        try {
            if (viewer.globalLight) viewer.globalLight.intensity = SKIN_LIGHT_INTENSITY;
            if (viewer.cameraLight) viewer.cameraLight.intensity = SKIN_LIGHT_INTENSITY;
        } catch (e) {}
        applyDefaultCamera(viewer);
        viewer.controls.enableZoom = true;
        viewer.controls.enablePan = false;
        viewer.controls.minDistance = 25;
        viewer.controls.maxDistance = 90;
        viewer.controls.minPolarAngle = 0.15;
        viewer.controls.maxPolarAngle = Math.PI - 0.15;
        try { viewer.nameTag = new skinview3d.NameTagObject(name); viewer.nameTag.visible = true; } catch (e) {}
        try { currentRotateAnim = viewer.animations.add(skinview3d.RotatingAnimation); } catch (e) {}

        const ok = await loadSkinBytes(viewer, name, uuid);
        if (ok) loading.classList.add('hidden');
        else {
            loading.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:32px;margin-bottom:8px;">🎭</div><div style="color:#f59e0b;font-weight:600;">Скин недоступен</div><div style="font-size:11px;color:#8b91a6;margin-top:6px;max-width:260px;">Показан стандартный Steve.<br>Для пиратки: data/skins/' + escapeHtml(name) + '.png</div></div>';
            setTimeout(() => loading.classList.add('hidden'), 2000);
        }
        currentSkinViewer = viewer;
        const ro = new ResizeObserver(() => {
            if (!currentSkinViewer) return;
            const w = wrap.clientWidth, h = wrap.clientHeight;
            if (w > 0 && h > 0) { currentSkinViewer.width = w; currentSkinViewer.height = h; }
        });
        ro.observe(wrap);
    } catch (err) {
        console.error('[skinview3d]', err);
        loading.innerHTML = '<div style="text-align:center;padding:20px;"><div style="color:#ef4444;font-weight:600;">Ошибка модели</div><div style="font-size:11px;color:#8b91a6;">' + escapeHtml(err.message || '') + '</div></div>';
    }
}

async function loadSkinBytes(viewer, name, uuid) {
    const sources = [LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png'];
    if (uuid) sources.push(CRAFATAR + '/skins/' + uuid.replace(/-/g, '') + '?default=MHF_Steve');
    sources.push(CRAFATAR + '/skins/' + STEVE_UUID + '?default=MHF_Steve');
    for (const url of sources) {
        try {
            const r = await fetch(url, { mode: 'cors', cache: 'no-cache' });
            if (!r.ok) continue;
            const buf = await r.arrayBuffer();
            if (!isPng(buf)) continue;
            await viewer.loadSkin(buf);
            console.log('[skinview3d] ✓ ' + name + ': ' + url.substring(0, 60) + ' (' + buf.byteLength + 'B)');
            return true;
        } catch (e) {}
    }
    return false;
}

function isPng(buffer) {
    if (!buffer || buffer.byteLength < 8) return false;
    const b = new Uint8Array(buffer, 0, 8);
    return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A;
}

function gotoCountry(name) {
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    const ov = document.querySelector('.main-nav .nav-btn[data-tab="overview"]');
    if (ov) ov.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const ovTab = document.getElementById('tab-overview');
    if (ovTab) ovTab.classList.add('active');
    highlightCountry(name);
    showDetails(name);
}

function gotoPlayerOnMap(name) {
    const players = currentData && currentData.players ? currentData.players : [];
    const p = players.find(x => x.name === name);
    if (!p || !p.position || !currentData.map_meta) return;
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    const mp = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
    if (mp) mp.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const mpTab = document.getElementById('tab-map');
    if (mpTab) mpTab.classList.add('active');
    setTimeout(() => {
        if (!mapReady) return;
        const pt = worldToImagePx(p.position.x, p.position.z, currentData.map_meta);
        const vp = document.getElementById('map-viewport');
        const vw = vp.clientWidth, vh = vp.clientHeight;
        mapZoom = 1.5;
        mapOffsetX = vw / 2 - pt.px * mapZoom;
        mapOffsetY = vh / 2 - pt.pz * mapZoom;
        applyMapTransform();
    }, 80);
}

function copyToClipboardSafe(text) {
    copyToClipboard(text).then(ok => { if (ok) showToast('✓ Скопировано: ' + text); });
}

function renderBonus() {
    if (!currentData) return;
    const jp = currentData.jackpot;
    const jpEl = document.getElementById('panel-jackpot');
    if (jpEl) {
        if (jp != null && jp > 0) { jpEl.style.display = 'block'; setText('jackpot-value', formatMoney(jp)); }
        else jpEl.style.display = 'none';
    }
    const events = currentData.events || [];
    const ep = document.getElementById('panel-events');
    if (ep) {
        if (events.length > 0) {
            ep.style.display = 'block';
            document.getElementById('events-list').innerHTML = events.map(e =>
                '<div class="event-item ' + (e.type === 'negative' ? 'negative' : 'positive') + '"><div><div class="name">' + escapeHtml(e.name || e.id || '?') + '</div><div class="desc">' + escapeHtml(e.description || '') + '</div></div></div>'
            ).join('');
        } else ep.style.display = 'none';
    }
    const wars = currentData.wars || [];
    const wp = document.getElementById('panel-wars');
    if (wp) {
        if (wars.length > 0) {
            wp.style.display = 'block';
            document.getElementById('wars-list').innerHTML = wars.map(w =>
                '<div class="war-item"><div><div class="name">' + escapeHtml(w.attacker) + ' ⚔ ' + escapeHtml(w.defender) + '</div><div class="desc">С ' + formatDate(w.started_at) + '</div></div></div>'
            ).join('');
        } else wp.style.display = 'none';
    }
    const poker = currentData.top_poker || [];
    const pp = document.getElementById('panel-poker');
    if (pp) {
        if (poker.length > 0) {
            pp.style.display = 'block';
            document.getElementById('poker-body').innerHTML = poker.map((p, i) =>
                '<tr><td class="rank">#' + (i + 1) + '</td><td class="name">' + escapeHtml(p.name || '?') + '</td><td class="' + (p.profit >= 0 ? 'money' : '') + '">' + (p.profit >= 0 ? '+' : '') + formatMoney(p.profit || 0) + '</td><td>' + (p.hands || 0) + '</td></tr>'
            ).join('');
        } else pp.style.display = 'none';
    }
    const bounties = currentData.bounties || [];
    const bp = document.getElementById('panel-bounties');
    if (bp) {
        if (bounties.length > 0) {
            bp.style.display = 'block';
            document.getElementById('bounties-list').innerHTML = bounties.map(b =>
                '<div class="bounty-item"><div><div class="name">' + escapeHtml(b.target || '?') + '</div><div class="desc">Награда: ' + formatMoney(b.amount || 0) + '</div></div></div>'
            ).join('');
        } else bp.style.display = 'none';
    }
    const anyBonus = (jp > 0) || events.length > 0 || wars.length > 0 || poker.length > 0 || bounties.length > 0;
    const be = document.getElementById('panel-bonus-empty');
    if (be) be.style.display = anyBonus ? 'none' : 'block';
}

function initCommandCopy() {
    document.body.addEventListener('click', e => {
        const t = e.target.closest('code[data-copy]');
        if (!t) return;
        e.preventDefault();
        const text = t.getAttribute('data-copy');
        if (!text) return;
        copyToClipboard(text).then(ok => { if (ok) showToast('✓ Скопировано: ' + text); });
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
}

let toastTimer = null;
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function initGuideNav() {
    const nav = document.getElementById('guide-nav');
    if (!nav) return;
    const sections = document.querySelectorAll('.guide-section h2[data-guide-title]');
    sections.forEach(h2 => {
        const section = h2.closest('.guide-section');
        if (!section) return;
        const a = document.createElement('a');
        a.href = '#' + section.id;
        a.textContent = h2.textContent.trim();
        a.dataset.target = section.id;
        nav.appendChild(a);
    });
    const navLinks = nav.querySelectorAll('a');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.dataset.target === entry.target.id));
        });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    sections.forEach(h2 => {
        const s = h2.closest('.guide-section');
        if (s) observer.observe(s);
    });
    navLinks.forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const el = document.getElementById(a.dataset.target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

const COMMANDS = [
    { cmd: '/c', desc: 'Меню страны', plugin: 'Sovereignty' },
    { cmd: '/c create МояСтрана', desc: 'Создать страну', plugin: 'Sovereignty' },
    { cmd: '/c claim', desc: 'Захватить чанк', plugin: 'Sovereignty' },
    { cmd: '/c unclaim', desc: 'Освободить чанк', plugin: 'Sovereignty' },
    { cmd: '/c bank', desc: 'Баланс казны', plugin: 'Sovereignty' },
    { cmd: '/c bank deposit 5000', desc: 'Внести в казну', plugin: 'Sovereignty' },
    { cmd: '/c bank withdraw 5000', desc: 'Снять из казны', plugin: 'Sovereignty' },
    { cmd: '/c upgrade', desc: 'Прокачка', plugin: 'Sovereignty' },
    { cmd: '/c boost', desc: 'Буст регенерации', plugin: 'Sovereignty' },
    { cmd: '/c research', desc: 'Исследования', plugin: 'Sovereignty' },
    { cmd: '/c court', desc: 'Суд', plugin: 'Sovereignty' },
    { cmd: '/c ally Steve', desc: 'Союз', plugin: 'Sovereignty' },
    { cmd: '/c enemy Steve', desc: 'Война', plugin: 'Sovereignty' },
    { cmd: '/c invite Steve', desc: 'Пригласить соправителя', plugin: 'Sovereignty' },
    { cmd: '/c accept', desc: 'Принять', plugin: 'Sovereignty' },
    { cmd: '/c decline', desc: 'Отклонить', plugin: 'Sovereignty' },
    { cmd: '/tax', desc: 'Налоги', plugin: 'TaxCollector' },
    { cmd: '/shop', desc: 'Рынок', plugin: 'MarketGUI' },
    { cmd: '/auc', desc: 'Аукцион', plugin: 'AuctionHouse' },
    { cmd: '/bounty Steve 5000', desc: 'Награда', plugin: 'Bounty' },
    { cmd: '/roll', desc: 'Казино', plugin: 'RollGame' },
    { cmd: '/roll slots 1000', desc: 'Слоты', plugin: 'RollGame' },
    { cmd: '/roll duel 1000', desc: 'Дуэль', plugin: 'RollGame' },
    { cmd: '/roll mines 1000 3 5', desc: 'Мины', plugin: 'RollGame' },
    { cmd: '/roll wheel 1000', desc: 'Колесо', plugin: 'RollGame' },
    { cmd: '/roll stairs 1000', desc: 'Лестница', plugin: 'RollGame' },
    { cmd: '/roll poker', desc: 'Покер', plugin: 'RollGame' },
    { cmd: '/bal', desc: 'Баланс', plugin: 'EssentialsX' },
    { cmd: '/pay Steve 1000', desc: 'Перевод', plugin: 'EssentialsX' },
    { cmd: '/sethome', desc: 'Дом', plugin: 'EssentialsX' },
    { cmd: '/home', desc: 'Домой', plugin: 'EssentialsX' },
    { cmd: '/jobs browse', desc: 'Профессии', plugin: 'Jobs' },
    { cmd: '/skin Steve', desc: 'Скин', plugin: 'SkinsRestorer' }
];

function initCommandSearch() {
    const list = document.getElementById('commands-list');
    if (!list) return;
    list.innerHTML = COMMANDS.map(c =>
        '<div class="command-item"><div class="cmd-name"><code data-copy="' + escapeAttr(c.cmd) + '">' + escapeHtml(c.cmd) + '</code></div><div class="cmd-desc">' + escapeHtml(c.desc) + '</div><div class="cmd-plugin">' + escapeHtml(c.plugin) + '</div></div>'
    ).join('');
    const inp = document.getElementById('cmd-search');
    if (!inp) return;
    inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        document.querySelectorAll('.command-item').forEach(item => {
            item.classList.toggle('hidden', q.length > 0 && !item.textContent.toLowerCase().includes(q));
        });
    });
}

function formatMoney(amount) {
    if (amount == null) return '0';
    if (Math.abs(amount) >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(amount) >= 1_000) return (amount / 1_000).toFixed(1) + 'k';
    return Math.round(amount).toString();
}

function formatPlaytime(sec) {
    if (sec == null || sec <= 0) return '';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return h > 0 ? d + 'д ' + h + 'ч' : d + 'д';
    if (h > 0) return m > 0 ? h + 'ч ' + m + 'м' : h + 'ч';
    if (m > 0) return m + 'м';
    return (sec % 60) + 'с';
}

function timeAgo(ts) {
    if (!ts) return '—';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' мин назад';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' ч назад';
    const d = Math.floor(h / 24);
    if (d < 30) return d + ' дн назад';
    return Math.floor(d / 30) + ' мес назад';
}

function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function shortenUuid(uuid) {
    if (!uuid) return '—';
    return uuid.length > 13 ? uuid.substring(0, 8) + '…' : uuid;
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
