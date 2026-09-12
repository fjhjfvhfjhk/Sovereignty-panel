/* Sovereignty panel v3.7 */

window.addEventListener('error', function (e) {
    console.error('[APP ERROR] ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
});

var APP_VERSION = 'v3.7';

var DATA_URL = 'data/server1.json';
var MAP_URL = 'data/map.png';
var LOCAL_SKIN_DIR = 'data/skins/';
var SKIN_API = 'https://mc-heads.net';
var CRAFATAR = 'https://crafatar.com';
var STEVE_UUID = '8667ba71-b85a-4004-af54-457a9734eed7';
var REFRESH_INTERVAL_MS = 5 * 60 * 1000;
var LOCAL_SKIN_TIMEOUT_MS = 3000;
var BLOCKS_PER_CHUNK = 16;
var PIXELS_PER_BLOCK = 2;

// Камера: крупный план, но с запасом чтобы всё тело влезло
var SKIN_FOV = 50;
var SKIN_CAM_TARGET_Y = 16;
var SKIN_CAM_X = 0;
var SKIN_CAM_Y = 16;
var SKIN_CAM_Z = 60;

var SKIN_GLOBAL_LIGHT = 1.8;
var SKIN_CAMERA_LIGHT = 1.5;
var MARKER_BASE_PX = 32;
var MARKER_MIN_PX = 18;
var MARKER_MAX_PX = 72;
var MARKER_GROWTH_POWER = 0.5;

var currentData = null;
var currentSort = 'claims';
var mapZoom = 1, mapOffsetX = 0, mapOffsetY = 0;
var isDragging = false, dragStartX = 0, dragStartY = 0, dragMoved = false;
var highlightedCountry = null;
var showPlayerMarkers = true;
var mapImage = null, mapCanvas = null, mapCtx = null, mapReady = false;
var currentSkinViewer = null, currentRotateAnim = null, rotatePaused = false;
var localSkinCache = new Map();
var headCache = new Map();
var localLoadedAttempted = new Set();

var PALETTE = ['#6366f1','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6','#a855f7','#f43f5e','#22d3ee','#a3e635','#facc15','#fb923c','#e879f9','#4ade80','#60a5fa','#fca5a5'];

document.addEventListener('DOMContentLoaded', function () {
    console.log('[Sovereignty] ' + APP_VERSION + ' DOMContentLoaded');
    try { initTabs(); } catch (e) { console.error('initTabs:', e); }
    try { initSortTabs(); } catch (e) { console.error('initSortTabs:', e); }
    try { initMapControls(); } catch (e) { console.error('initMapControls:', e); }
    try { initCommandCopy(); } catch (e) { console.error('initCommandCopy:', e); }
    try { initGuideNav(); } catch (e) { console.error('initGuideNav:', e); }
    try { initCommandSearch(); } catch (e) { console.error('initCommandSearch:', e); }
    try { initPlayerControls(); } catch (e) { console.error('initPlayerControls:', e); }
    try { initModalControls(); } catch (e) { console.error('initModalControls:', e); }
    try {
        var rb = document.getElementById('refresh-btn');
        if (rb) rb.onclick = function () { loadData(); loadMap(); };
    } catch (e) {}
    loadData();
    setInterval(loadData, REFRESH_INTERVAL_MS);
    setInterval(function () {
        if (!currentRotateAnim) return;
        try { if (rotatePaused && !currentRotateAnim.paused) currentRotateAnim.paused = true; } catch (e) {}
    }, 300);
});

function initTabs() {
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tab = btn.dataset.tab;
            document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            var t = document.getElementById('tab-' + tab);
            if (t) t.classList.add('active');
            if (tab === 'map' && mapReady) setTimeout(resetMapView, 50);
        });
    });
}

function initSortTabs() {
    document.querySelectorAll('.tab[data-sort]').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab[data-sort]').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            currentSort = tab.dataset.sort;
            renderCountries();
        });
    });
}

function initModalControls() {
    document.querySelectorAll('[data-modal-close]').forEach(function (el) {
        el.addEventListener('click', function () { closePlayerModal(); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePlayerModal(); });
    var rotBtn = document.getElementById('skin-toggle-rotate');
    if (rotBtn) rotBtn.onclick = function () {
        rotatePaused = !rotatePaused;
        rotBtn.textContent = rotatePaused ? '▶ Пуск' : '⏸ Пауза';
        rotBtn.classList.toggle('active', rotatePaused);
    };
    var resetBtn = document.getElementById('skin-reset-view');
    if (resetBtn) resetBtn.onclick = function () {
        if (currentSkinViewer) applySkinCamera(currentSkinViewer);
    };
    var nameBtn = document.getElementById('skin-toggle-name');
    if (nameBtn) nameBtn.onclick = function () {
        if (currentSkinViewer && currentSkinViewer.nameTag)
            currentSkinViewer.nameTag.visible = !currentSkinViewer.nameTag.visible;
    };
}

function openPlayerModal() {
    var m = document.getElementById('player-modal');
    if (m) m.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
    var m = document.getElementById('player-modal');
    if (m) m.classList.remove('show');
    document.body.style.overflow = '';
    if (currentSkinViewer) { try { currentSkinViewer.dispose(); } catch (e) {} currentSkinViewer = null; }
    currentRotateAnim = null;
    rotatePaused = false;
    var btn = document.getElementById('skin-toggle-rotate');
    if (btn) { btn.textContent = '⏸ Пауза'; btn.classList.remove('active'); }
}

/* LOCAL SKINS */
function preloadLocalSkins() {
    var players = currentData && currentData.players ? currentData.players : [];
    if (players.length === 0) return;
    var toLoad = players.filter(function (p) { return p.name && !localLoadedAttempted.has(p.name); });
    if (toLoad.length === 0) return;
    var done = 0, loaded = 0;
    toLoad.forEach(function (p) {
        localLoadedAttempted.add(p.name);
        loadLocalSkin(p.name).then(function () { loaded++; }).catch(function () {}).finally(function () {
            done++;
            if (done === toLoad.length) {
                console.log('[Skins] Готово: ' + loaded + '/' + toLoad.length);
                refreshHeadImages();
            }
        });
    });
}

function loadLocalSkin(name) {
    if (localSkinCache.has(name)) return Promise.resolve(localSkinCache.get(name));
    var url = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
    return new Promise(function (resolve, reject) {
        var img = new Image();
        var finished = false;
        var timer = setTimeout(function () {
            if (finished) return;
            finished = true;
            img.src = '';
            reject(new Error('timeout'));
        }, LOCAL_SKIN_TIMEOUT_MS);
        img.onload = function () {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (img.width < 64 || (img.height !== 32 && img.height !== 64)) {
                reject(new Error('bad format'));
                return;
            }
            localSkinCache.set(name, img);
            try { headCache.set(name, headFromSkin(img)); } catch (e) {}
            resolve(img);
        };
        img.onerror = function () {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            reject(new Error('404'));
        };
        img.src = url;
    });
}

function headFromSkin(skinImg) {
    var canvas = document.createElement('canvas');
    canvas.width = 8; canvas.height = 8;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(skinImg, 8, 8, 8, 8, 0, 0, 8, 8);
    if (skinImg.width >= 64 && skinImg.height >= 64) {
        ctx.drawImage(skinImg, 40, 8, 8, 8, 0, 0, 8, 8);
    }
    return canvas.toDataURL('image/png');
}

function getHeadUrl(name, size) {
    if (headCache.has(name)) return headCache.get(name);
    return SKIN_API + '/avatar/' + encodeURIComponent(name) + '/' + (size || 64);
}

function refreshHeadImages() {
    var updated = 0;
    document.querySelectorAll('img[data-pname]').forEach(function (img) {
        var name = img.getAttribute('data-pname');
        if (headCache.has(name)) { img.src = headCache.get(name); updated++; }
    });
    if (updated > 0) console.log('[Skins] Обновлено голов: ' + updated);
}

/* DATA */
function loadData() {
    var tbody = document.getElementById('countries-body');
    if (tbody && tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">⏳ Загрузка данных...</td></tr>';
    }
    fetch(DATA_URL + '?t=' + Date.now())
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(function (text) {
            if (!text || !text.trim()) throw new Error('Пустой файл');
            currentData = JSON.parse(text);
            console.log('[Sovereignty] загружено, игроков: ' + ((currentData.players || []).length));
            render();
            loadMap();
            setTimeout(preloadLocalSkins, 0);
        })
        .catch(function (err) {
            console.error('[Sovereignty] load error:', err);
            var sn = document.getElementById('server-name');
            if (sn) sn.textContent = '⚠ Ошибка';
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="loading" style="color:#ef4444;">❌ ' + escapeHtml(err.message) + '</td></tr>';
        });
}

function render() {
    if (!currentData) return;
    var sn = document.getElementById('server-name');
    if (sn) sn.textContent = currentData.server_name || 'Сервер';
    var ob = document.getElementById('online-badge');
    if (ob) ob.textContent = 'Онлайн: ' + (currentData.online_players || 0) + ' / ' + (currentData.max_players || 0);
    var upd = currentData.updated_at;
    if (upd) {
        var m = Math.floor((Date.now() - upd) / 60000);
        var ago = m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : Math.floor(m / 60) + ' ч назад';
        var ub = document.getElementById('updated-badge');
        if (ub) ub.textContent = 'Обновлено: ' + ago;
    }
    var countries = currentData.countries || [];
    var players = currentData.players || [];
    setText('countries-count', countries.length);
    setText('total-claims', countries.reduce(function (s, c) { return s + (c.claims || 0); }, 0).toLocaleString('ru-RU'));
    setText('total-bank', formatMoney(countries.reduce(function (s, c) { return s + (c.bank || 0); }, 0)));
    setText('total-energy', countries.reduce(function (s, c) { return s + (c.energy || 0); }, 0).toFixed(1));
    var tp = document.getElementById('total-players');
    if (tp) {
        if (players.length > 0) {
            var online = players.filter(function (p) { return p.online; }).length;
            tp.textContent = online > 0 ? online + ' / ' + players.length : String(players.length);
        } else tp.textContent = String(currentData.online_players || 0);
    }
    renderCountries();
    renderLegend();
    renderPlayers();
    renderBonus();
    renderPlayerMarkers();
}

function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

function renderCountries() {
    if (!currentData) return;
    var countries = (currentData.countries || []).slice();
    countries.sort(function (a, b) {
        if (currentSort === 'bank') return (b.bank || 0) - (a.bank || 0);
        if (currentSort === 'energy') return (b.energy || 0) - (a.energy || 0);
        if (currentSort === 'allies') return (b.allies || 0) - (a.allies || 0);
        return (b.claims || 0) - (a.claims || 0);
    });
    var tbody = document.getElementById('countries-body');
    if (!tbody) return;
    if (countries.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="loading">Пока нет стран.</td></tr>'; return; }
    tbody.innerHTML = countries.map(function (c, i) {
        var rc = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
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
    var legend = document.getElementById('map-legend');
    if (!legend) return;
    var countries = currentData && currentData.countries ? currentData.countries : [];
    if (countries.length === 0) { legend.innerHTML = ''; return; }
    legend.innerHTML = countries.map(function (c, i) {
        return '<div class="legend-item" data-country="' + escapeAttr(c.name) + '" onclick="highlightCountry(\'' + escapeAttr(c.name) + '\')">' +
            '<div class="legend-color" style="background:' + PALETTE[i % PALETTE.length] + '"></div>' +
            '<span>' + escapeHtml(c.name) + '</span></div>';
    }).join('');
}

function highlightCountry(name) {
    highlightedCountry = highlightedCountry === name ? null : name;
    document.querySelectorAll('.legend-item').forEach(function (el) {
        el.classList.toggle('highlight', el.dataset.country === highlightedCountry);
    });
    if (highlightedCountry) showDetails(highlightedCountry);
}

function showDetails(countryName) {
    var countries = currentData && currentData.countries ? currentData.countries : [];
    var country = countries.filter(function (c) { return c.name === countryName; })[0];
    if (!country) return;
    var dt = document.getElementById('detail-title');
    if (dt) dt.textContent = '🏛️ ' + country.name;
    var content = document.getElementById('detail-content');
    if (!content) return;
    var items = [
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
    content.innerHTML = items.map(function (it) {
        return '<div class="detail-item"><div class="label">' + it.label + '</div>' +
            '<div class="value ' + (it.cls || '') + '">' + escapeHtml(String(it.value)) + '</div></div>';
    }).join('');
    var cd = document.getElementById('country-details');
    if (cd) { cd.style.display = 'block'; cd.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

/* MAP */
function loadMap() {
    var ph = document.getElementById('map-placeholder');
    var canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        var first = !mapReady;
        mapImage = img;
        setupCanvas(img.naturalWidth, img.naturalHeight);
        mapReady = true;
        if (ph) ph.style.display = 'none';
        canvas.style.display = 'block';
        if (first) setTimeout(resetMapView, 50);
        else applyMapTransform();
        renderPlayerMarkers();
    };
    img.onerror = function () {
        mapReady = false;
        canvas.style.display = 'none';
        if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div class="map-placeholder-icon">🗺️</div><p>Карта не сгенерирована.</p>'; }
    };
    img.src = MAP_URL + '?t=' + Date.now();
}

function setupCanvas(w, h) {
    var canvas = document.getElementById('map-canvas');
    canvas.width = w; canvas.height = h;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    mapCanvas = canvas;
    mapCtx = canvas.getContext('2d', { willReadFrequently: true });
    mapCtx.drawImage(mapImage, 0, 0);
}

function initMapControls() {
    var vp = document.getElementById('map-viewport');
    if (!vp) return;
    vp.addEventListener('mousedown', function (e) {
        if (!mapReady || e.target.closest('.map-marker')) return;
        isDragging = true; dragMoved = false;
        dragStartX = e.clientX - mapOffsetX;
        dragStartY = e.clientY - mapOffsetY;
    });
    window.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        var nx = e.clientX - dragStartX, ny = e.clientY - dragStartY;
        if (Math.abs(nx - mapOffsetX) > 3 || Math.abs(ny - mapOffsetY) > 3) dragMoved = true;
        mapOffsetX = nx; mapOffsetY = ny;
        applyMapTransform();
    });
    window.addEventListener('mouseup', function () { isDragging = false; });
    vp.addEventListener('click', function (e) {
        if (!mapReady || dragMoved || e.target.closest('.map-marker')) return;
        handleMapClick(e);
    });
    vp.addEventListener('wheel', function (e) {
        if (!mapReady) return;
        e.preventDefault();
        var rect = vp.getBoundingClientRect();
        var cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        var ix = (cx - mapOffsetX) / mapZoom, iy = (cy - mapOffsetY) / mapZoom;
        var delta = e.deltaY > 0 ? 0.9 : 1.1;
        mapZoom = Math.max(0.1, Math.min(12, mapZoom * delta));
        mapOffsetX = cx - ix * mapZoom;
        mapOffsetY = cy - iy * mapZoom;
        applyMapTransform();
    }, { passive: false });
    var rb = document.getElementById('map-reset');
    if (rb) rb.addEventListener('click', resetMapView);
    var cb = document.getElementById('map-clear-highlight');
    if (cb) cb.addEventListener('click', function () {
        highlightedCountry = null;
        document.querySelectorAll('.legend-item').forEach(function (el) { el.classList.remove('highlight'); });
        var cd = document.getElementById('country-details');
        if (cd) cd.style.display = 'none';
    });
    var sp = document.getElementById('map-show-players');
    if (sp) sp.addEventListener('change', function () { showPlayerMarkers = sp.checked; renderPlayerMarkers(); });
}

function handleMapClick(e) {
    var vp = document.getElementById('map-viewport');
    var rect = vp.getBoundingClientRect();
    var cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    var ix = Math.round((cx - mapOffsetX) / mapZoom);
    var iy = Math.round((cy - mapOffsetY) / mapZoom);
    if (ix < 0 || iy < 0 || ix >= mapCanvas.width || iy >= mapCanvas.height) return;
    var px;
    try { px = mapCtx.getImageData(ix, iy, 1, 1).data; } catch (err) { return; }
    if (px[3] < 10) return;
    var countries = currentData && currentData.countries ? currentData.countries : [];
    var bestIdx = -1, bestDist = 120;
    countries.forEach(function (c, i) {
        var rgb = hexToRgb(PALETTE[i % PALETTE.length]);
        var d = Math.sqrt(Math.pow(px[0] - rgb[0], 2) + Math.pow(px[1] - rgb[1], 2) + Math.pow(px[2] - rgb[2], 2));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx === -1) return;
    var country = countries[bestIdx];
    highlightCountry(country.name);
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var ov = document.querySelector('.main-nav .nav-btn[data-tab="overview"]');
    if (ov) ov.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var ovTab = document.getElementById('tab-overview');
    if (ovTab) ovTab.classList.add('active');
    showDetails(country.name);
}

function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function applyMapTransform() {
    var canvas = document.getElementById('map-canvas');
    var overlay = document.getElementById('map-overlay');
    if (!canvas) return;
    var t = 'translate(' + mapOffsetX + 'px,' + mapOffsetY + 'px) scale(' + mapZoom + ')';
    canvas.style.transform = t;
    if (overlay) { overlay.style.transform = t; updateMarkerScale(); }
}

function updateMarkerScale() {
    var overlay = document.getElementById('map-overlay');
    if (!overlay) return;
    var z = Math.max(0.05, mapZoom);
    var desired = MARKER_BASE_PX * Math.pow(z, MARKER_GROWTH_POWER);
    var clamped = Math.max(MARKER_MIN_PX, Math.min(MARKER_MAX_PX, desired));
    var counter = clamped / (MARKER_BASE_PX * z);
    overlay.style.setProperty('--marker-counter', counter.toFixed(4));
}

function resetMapView() {
    var canvas = document.getElementById('map-canvas');
    var vp = document.getElementById('map-viewport');
    if (!canvas || !vp || !mapReady) return;
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var iw = mapCanvas.width, ih = mapCanvas.height;
    var scale = Math.min(vw / iw, vh / ih) * 0.98;
    mapZoom = scale;
    mapOffsetX = (vw - iw * scale) / 2;
    mapOffsetY = (vh - ih * scale) / 2;
    applyMapTransform();
}

function worldToImagePx(x, z, meta) {
    var minBX = meta.min_chunk_x * BLOCKS_PER_CHUNK;
    var minBZ = meta.min_chunk_z * BLOCKS_PER_CHUNK;
    return { px: (x - minBX) * PIXELS_PER_BLOCK, pz: (z - minBZ) * PIXELS_PER_BLOCK };
}

function renderPlayerMarkers() {
    var overlay = document.getElementById('map-overlay');
    if (!overlay) return;
    if (!showPlayerMarkers || !mapReady || !currentData) { overlay.innerHTML = ''; return; }
    var meta = currentData.map_meta;
    var players = currentData.players || [];
    if (!meta || players.length === 0) { overlay.innerHTML = ''; return; }
    var markers = [];
    players.forEach(function (p) {
        var pos = p.position;
        if (!pos || pos.x == null || pos.z == null) return;
        if (pos.world && meta.world && pos.world !== meta.world) return;
        var pt = worldToImagePx(pos.x, pos.z, meta);
        if (pt.px < 0 || pt.pz < 0 || pt.px > mapCanvas.width || pt.pz > mapCanvas.height) return;
        var online = !!p.online;
        var name = p.name || '?';
        var headUrl = getHeadUrl(name, 32);
        var fallback = SKIN_API + '/avatar/Steve/32';
        markers.push('<div class="map-marker ' + (online ? 'online' : '') + '" style="left:' + pt.px + 'px;top:' + pt.pz + 'px;" onclick="openPlayer(\'' + escapeAttr(name) + '\');event.stopPropagation();" title="' + escapeAttr(name) + '">' +
            '<div class="map-marker-content">' +
            '<img class="map-marker-head" src="' + headUrl + '" data-pname="' + escapeAttr(name) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
            '<div class="map-marker-label">' + escapeHtml(name) + '</div></div></div>');
    });
    overlay.innerHTML = markers.join('');
    updateMarkerScale();
}

/* PLAYERS */
function initPlayerControls() {
    var s = document.getElementById('player-search');
    if (s) s.addEventListener('input', renderPlayers);
    var o = document.getElementById('player-online-only');
    if (o) o.addEventListener('change', renderPlayers);
}

function renderPlayers() {
    var grid = document.getElementById('players-grid');
    var empty = document.getElementById('players-empty');
    if (!grid || !empty) return;
    var players = currentData && currentData.players ? currentData.players : null;
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
        return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.country || '').toLowerCase().indexOf(q) !== -1;
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
    grid.innerHTML = filtered.map(renderPlayerCard).join('');
}

function renderPlayerCard(p) {
    var name = p.name || '?';
    var avatar = getHeadUrl(name, 64);
    var fallback = SKIN_API + '/avatar/Steve/64';
    var online = !!p.online;
    var badge = '';
    if (p.country_role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
    else if (p.country_role === 'co_ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';
    var pt = formatPlaytime(p.playtime_seconds);
    var money = p.balance != null ? formatMoney(p.balance) : null;
    return '<div class="player-card" onclick="openPlayer(\'' + escapeAttr(name) + '\')">' +
        badge +
        '<div class="player-card-avatar">' +
        '<img src="' + avatar + '" data-pname="' + escapeAttr(name) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
        '<div class="status-dot ' + (online ? 'online' : 'offline') + '"></div></div>' +
        '<div class="player-card-info">' +
        '<div class="player-card-name">' + escapeHtml(name) + '</div>' +
        '<div class="player-card-country">' + (p.country ? '<span class="country-tag">🏛️ ' + escapeHtml(p.country) + '</span>' : '<span class="no-country">Без страны</span>') + '</div>' +
        '<div class="player-card-meta">' +
        (money != null ? '<span class="money">💰 ' + money + '</span>' : '') +
        (pt ? '<span>⏱ ' + pt + '</span>' : '') +
        '</div></div></div>';
}

function openPlayer(name) {
    var players = currentData && currentData.players ? currentData.players : [];
    var player = players.filter(function (p) { return p.name === name; })[0];
    if (!player) return;
    var online = !!player.online;
    setText('player-modal-name', name);
    var st = document.getElementById('player-modal-status');
    if (st) {
        st.textContent = online ? '● Онлайн' : '○ Оффлайн';
        st.className = 'player-modal-status ' + (online ? 'online' : 'offline');
    }

    var accountRows = [];
    if (player.uuid) accountRows.push({ label: 'UUID', value: shortenUuid(player.uuid), copy: player.uuid });
    if (player.first_seen) accountRows.push({ label: 'Первый вход', value: timeAgo(player.first_seen) });
    if (player.last_seen) accountRows.push({ label: 'Был в игре', value: timeAgo(player.last_seen) });
    if (player.playtime_seconds != null) accountRows.push({ label: 'Время в игре', value: formatPlaytime(player.playtime_seconds) });
    if (player.playtime_seconds > 0) accountRows.push({ label: 'Дней в игре', value: Math.floor(player.playtime_seconds / 86400) });

    var ecoRows = [];
    if (player.balance != null) ecoRows.push({ label: 'Баланс', value: formatMoney(player.balance), cls: 'success' });
    if (player.job) ecoRows.push({ label: 'Профессия', value: player.job + (player.job_level ? ' (ур. ' + player.job_level + ')' : '') });
    if (player.kills != null || player.deaths != null) {
        var k = player.kills || 0, d = player.deaths || 0;
        var kd = d > 0 ? (k / d).toFixed(2) : k;
        ecoRows.push({ label: 'Убийств', value: k });
        ecoRows.push({ label: 'Смертей', value: d });
        ecoRows.push({ label: 'K/D', value: kd });
    }
    if (player.bounty != null && player.bounty > 0) ecoRows.push({ label: '💀 Награда', value: formatMoney(player.bounty), cls: 'danger' });

    var countryRows = [];
    if (player.country) {
        countryRows.push({ label: 'Название', value: player.country, cls: 'accent', copy: player.country });
        if (player.country_role) {
            var rn = player.country_role === 'leader' ? 'Лидер'
                : player.country_role === 'co_ruler' ? 'Соправитель' : player.country_role;
            countryRows.push({ label: 'Роль', value: rn });
        }
        var cd = (currentData.countries || []).filter(function (c) { return c.name === player.country; })[0];
        if (cd) {
            if (cd.bank != null) countryRows.push({ label: 'Казна страны', value: formatMoney(cd.bank) });
            if (cd.claims != null) countryRows.push({ label: 'Территория', value: cd.claims + ' чанков' });
            if (cd.allies != null) countryRows.push({ label: 'Союзы', value: cd.allies });
            if (cd.pacts != null) countryRows.push({ label: 'Пакты', value: cd.pacts });
        }
    } else countryRows.push({ label: 'Страна', value: 'Нет' });

    var actRows = [];
    if (player.energy != null) actRows.push({
        label: 'Энергия',
        value: player.energy.toFixed(1) + (player.max_energy != null ? ' / ' + player.max_energy.toFixed(1) : ''),
        cls: 'warning'
    });
    if (player.achievements_count != null) actRows.push({ label: 'Достижений', value: player.achievements_count });
    if (player.position) {
        var pos = player.position;
        actRows.push({ label: 'Локация', value: Math.round(pos.x) + ', ' + Math.round(pos.y || 0) + ', ' + Math.round(pos.z) });
    }

    var panelsEl = document.getElementById('player-modal-panels');
    if (panelsEl) {
        panelsEl.innerHTML =
            renderPanel('Учётная запись', accountRows) +
            renderPanel('Экономика', ecoRows) +
            renderPanel('Страна', countryRows) +
            renderPanel('Активность', actRows);
    }

    var actions = [];
    if (player.country) actions.push('<button class="player-modal-btn" onclick="gotoCountry(\'' + escapeAttr(player.country) + '\')">🏛️ Перейти к стране</button>');
    if (player.position) actions.push('<button class="player-modal-btn" onclick="gotoPlayerOnMap(\'' + escapeAttr(name) + '\')">🗺️ На карте</button>');
    actions.push('<button class="player-modal-btn" onclick="copyToClipboardSafe(\'' + escapeAttr(name) + '\')">📋 Скопировать ник</button>');
    var actBtnEl = document.getElementById('player-modal-actions');
    if (actBtnEl) actBtnEl.innerHTML = actions.join('');

    openPlayerModal();
    setTimeout(function () { initSkinViewer(name, player.uuid); }, 100);
}

function renderPanel(title, rows) {
    var valid = (rows || []).filter(function (r) { return r.value !== undefined && r.value !== null && r.value !== ''; });
    if (valid.length === 0) return '';
    return '<div class="player-panel">' +
        '<div class="player-panel-title">' + escapeHtml(title) + '</div>' +
        valid.map(renderPanelRow).join('') +
        '</div>';
}

function renderPanelRow(r) {
    var copyBtn = r.copy
        ? '<button class="player-copy-btn" onclick="copyToClipboardSafe(\'' + escapeAttr(r.copy) + '\')" title="Скопировать">📋 Копировать</button>'
        : '';
    return '<div class="player-panel-row">' +
        '<div class="row-label">' + escapeHtml(r.label) + '</div>' +
        '<div class="row-value ' + (r.cls || '') + '">' + escapeHtml(String(r.value)) + '</div>' +
        copyBtn +
        '</div>';
}

/* 3D VIEWER */

function applySkinCamera(viewer) {
    try {
        // fov через raw API
        if (viewer.camera) {
            viewer.camera.fov = SKIN_FOV;
            viewer.camera.updateProjectionMatrix();
        }

        // target и позиция камеры
        viewer.controls.target.set(SKIN_CAM_X, SKIN_CAM_TARGET_Y, 0);
        viewer.camera.position.set(SKIN_CAM_X, SKIN_CAM_Y, SKIN_CAM_Z);
        viewer.controls.update();

        // Диагностика — все критичные параметры
        var p = viewer.camera.position;
        var t = viewer.controls.target;
        var dist = Math.sqrt(
            Math.pow(p.x - t.x, 2) + Math.pow(p.y - t.y, 2) + Math.pow(p.z - t.z, 2)
        );
        console.log('[skinview3d] ' + APP_VERSION +
            ' cam=(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ',' + p.z.toFixed(1) + ')' +
            ' target=(' + t.x.toFixed(1) + ',' + t.y.toFixed(1) + ',' + t.z.toFixed(1) + ')' +
            ' dist=' + dist.toFixed(1) +
            ' fov=' + (viewer.camera ? viewer.camera.fov : '?') +
            ' aspect=' + (viewer.camera ? viewer.camera.aspect.toFixed(2) : '?'));
    } catch (e) {
        console.error('[skinview3d] applySkinCamera error:', e);
    }
}

function resolveSkinUrl(name, uuid) {
    if (localSkinCache.has(name)) return LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
    if (uuid) return CRAFATAR + '/skins/' + uuid.replace(/-/g, '') + '?default=MHF_Steve';
    return CRAFATAR + '/skins/' + STEVE_UUID + '?default=MHF_Steve';
}

function initSkinViewer(name, uuid) {
    var wrap = document.getElementById('player-viewer-wrap');
    if (!wrap) return;
    var oldCanvas = document.getElementById('skin-canvas');
    if (oldCanvas && oldCanvas.parentNode) oldCanvas.parentNode.removeChild(oldCanvas);
    var newCanvas = document.createElement('canvas');
    newCanvas.id = 'skin-canvas';
    wrap.insertBefore(newCanvas, wrap.firstChild);

    var loading = document.getElementById('skin-loading');
    if (currentSkinViewer) { try { currentSkinViewer.dispose(); } catch (e) {} currentSkinViewer = null; }
    if (loading) {
        loading.classList.remove('hidden');
        loading.innerHTML = '<div class="spinner"></div><div>Загрузка скина...</div>';
    }

    var waited = 0;
    function waitSkinview() {
        if (window.__skinview3dStatus === 'loaded' && typeof skinview3d !== 'undefined') { startViewer(); return; }
        if (window.__skinview3dStatus === 'failed' || waited >= 5000) {
            if (loading) loading.innerHTML = '<div style="text-align:center;padding:20px;">' +
                '<div style="font-size:32px;margin-bottom:8px;">⚠</div>' +
                '<div style="color:#f59e0b;font-weight:600;">Библиотека 3D не загрузилась</div></div>';
            return;
        }
        waited += 100;
        setTimeout(waitSkinview, 100);
    }
    waitSkinview();

    function startViewer() {
        wrap.getBoundingClientRect();
        setTimeout(function () {
            var rect = wrap.getBoundingClientRect();
            var size = Math.max(280, Math.round(rect.width || 380));
            var skinUrl = resolveSkinUrl(name, uuid);

            console.log('[skinview3d] ' + APP_VERSION + ' canvas=' + size + ' skin=' + skinUrl);

            try {
                var viewer = new skinview3d.SkinViewer({
                    canvas: newCanvas,
                    width: size,
                    height: size
                });

                // fov сразу через raw API
                if (viewer.camera) {
                    viewer.camera.fov = SKIN_FOV;
                    viewer.camera.updateProjectionMatrix();
                }

                // Свет
                try {
                    if (viewer.globalLight) viewer.globalLight.intensity = SKIN_GLOBAL_LIGHT;
                    if (viewer.cameraLight) viewer.cameraLight.intensity = SKIN_CAMERA_LIGHT;
                } catch (e) {}

                // Контролы
                viewer.controls.enableZoom = true;
                viewer.controls.enablePan = false;
                viewer.controls.enableRotate = true;
                viewer.controls.rotateSpeed = 1.0;
                viewer.controls.zoomSpeed = 0.8;
                viewer.controls.minPolarAngle = 0.05;
                viewer.controls.maxPolarAngle = Math.PI - 0.05;
                viewer.controls.minDistance = 20;
                viewer.controls.maxDistance = 200;

                // Ник
                try {
                    viewer.nameTag = new skinview3d.NameTagObject(name);
                    viewer.nameTag.visible = true;
                } catch (e) {}

                // Автовращение
                try { currentRotateAnim = viewer.animations.add(skinview3d.RotatingAnimation); } catch (e) {}

                // Pause при drag
                var userInteracting = false;
                newCanvas.addEventListener('pointerdown', function () {
                    userInteracting = true;
                    if (currentRotateAnim) { try { currentRotateAnim.paused = true; } catch (e) {} }
                });
                newCanvas.addEventListener('pointerup', function () {
                    userInteracting = false;
                    setTimeout(function () {
                        if (userInteracting || rotatePaused) return;
                        if (currentRotateAnim) { try { currentRotateAnim.paused = false; } catch (e) {} }
                    }, 1500);
                });
                newCanvas.addEventListener('pointercancel', function () { userInteracting = false; });

                currentSkinViewer = viewer;

                // Применяем камеру СРАЗУ
                applySkinCamera(viewer);

                // Потом загружаем скин и применяем камеру ЕЩЁ РАЗ после загрузки
                viewer.loadSkin(skinUrl).then(function () {
                    console.log('[skinview3d] skin loaded');
                    if (currentSkinViewer === viewer) applySkinCamera(viewer);
                    if (loading) loading.classList.add('hidden');
                    // И ещё раз через паузу — вдруг skinview3d делает auto-reset
                    setTimeout(function () {
                        if (currentSkinViewer === viewer) applySkinCamera(viewer);
                    }, 500);
                }).catch(function (err) {
                    console.warn('[skinview3d] skin load fail:', err);
                    if (currentSkinViewer === viewer) applySkinCamera(viewer);
                    if (loading) loading.classList.add('hidden');
                });

                var ro = new ResizeObserver(function () {
                    if (!currentSkinViewer) return;
                    var w = wrap.clientWidth, h = wrap.clientHeight;
                    if (w > 0 && h > 0) {
                        currentSkinViewer.width = w;
                        currentSkinViewer.height = h;
                    }
                });
                ro.observe(wrap);

            } catch (err) {
                console.error('[skinview3d] error:', err);
                if (loading) loading.innerHTML = '<div style="text-align:center;padding:20px;">' +
                    '<div style="font-size:32px;margin-bottom:8px;">⚠</div>' +
                    '<div style="color:#ef4444;font-weight:600;">Ошибка 3D-модели</div>' +
                    '<div style="font-size:11px;color:#8b91a6;margin-top:6px;">' + escapeHtml(err.message || String(err)) + '</div>' +
                    '</div>';
            }
        }, 60);
    }
}

/* NAV */
function gotoCountry(name) {
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var ov = document.querySelector('.main-nav .nav-btn[data-tab="overview"]');
    if (ov) ov.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var ovTab = document.getElementById('tab-overview');
    if (ovTab) ovTab.classList.add('active');
    highlightCountry(name);
    showDetails(name);
}

function gotoPlayerOnMap(name) {
    var players = currentData && currentData.players ? currentData.players : [];
    var p = players.filter(function (x) { return x.name === name; })[0];
    if (!p || !p.position || !currentData.map_meta) return;
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var mp = document.querySelector('.main-nav .nav-btn[data-tab="map"]');
    if (mp) mp.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var mpTab = document.getElementById('tab-map');
    if (mpTab) mpTab.classList.add('active');
    setTimeout(function () {
        if (!mapReady) return;
        var pt = worldToImagePx(p.position.x, p.position.z, currentData.map_meta);
        var vp = document.getElementById('map-viewport');
        var vw = vp.clientWidth, vh = vp.clientHeight;
        mapZoom = 1.5;
        mapOffsetX = vw / 2 - pt.px * mapZoom;
        mapOffsetY = vh / 2 - pt.pz * mapZoom;
        applyMapTransform();
    }, 80);
}

function copyToClipboardSafe(text) {
    copyToClipboard(text).then(function (ok) { if (ok) showToast('✓ Скопировано: ' + text); });
}

/* BONUS */
function renderBonus() {
    if (!currentData) return;
    var jp = currentData.jackpot;
    var jpEl = document.getElementById('panel-jackpot');
    if (jpEl) {
        if (jp != null && jp > 0) { jpEl.style.display = 'block'; setText('jackpot-value', formatMoney(jp)); }
        else jpEl.style.display = 'none';
    }
    var events = currentData.events || [];
    var ep = document.getElementById('panel-events');
    if (ep) {
        if (events.length > 0) {
            ep.style.display = 'block';
            document.getElementById('events-list').innerHTML = events.map(function (e) {
                return '<div class="event-item ' + (e.type === 'negative' ? 'negative' : 'positive') + '"><div><div class="name">' + escapeHtml(e.name || e.id || '?') + '</div><div class="desc">' + escapeHtml(e.description || '') + '</div></div></div>';
            }).join('');
        } else ep.style.display = 'none';
    }
    var wars = currentData.wars || [];
    var wp = document.getElementById('panel-wars');
    if (wp) {
        if (wars.length > 0) {
            wp.style.display = 'block';
            document.getElementById('wars-list').innerHTML = wars.map(function (w) {
                return '<div class="war-item"><div><div class="name">' + escapeHtml(w.attacker) + ' ⚔ ' + escapeHtml(w.defender) + '</div><div class="desc">С ' + formatDate(w.started_at) + '</div></div></div>';
            }).join('');
        } else wp.style.display = 'none';
    }
    var poker = currentData.top_poker || [];
    var pp = document.getElementById('panel-poker');
    if (pp) {
        if (poker.length > 0) {
            pp.style.display = 'block';
            document.getElementById('poker-body').innerHTML = poker.map(function (p, i) {
                return '<tr><td class="rank">#' + (i + 1) + '</td><td class="name">' + escapeHtml(p.name || '?') + '</td><td class="' + (p.profit >= 0 ? 'money' : '') + '">' + (p.profit >= 0 ? '+' : '') + formatMoney(p.profit || 0) + '</td><td>' + (p.hands || 0) + '</td></tr>';
            }).join('');
        } else pp.style.display = 'none';
    }
    var bounties = currentData.bounties || [];
    var bp = document.getElementById('panel-bounties');
    if (bp) {
        if (bounties.length > 0) {
            bp.style.display = 'block';
            document.getElementById('bounties-list').innerHTML = bounties.map(function (b) {
                return '<div class="bounty-item"><div><div class="name">' + escapeHtml(b.target || '?') + '</div><div class="desc">Награда: ' + formatMoney(b.amount || 0) + '</div></div></div>';
            }).join('');
        } else bp.style.display = 'none';
    }
    var anyBonus = (jp > 0) || events.length > 0 || wars.length > 0 || poker.length > 0 || bounties.length > 0;
    var be = document.getElementById('panel-bonus-empty');
    if (be) be.style.display = anyBonus ? 'none' : 'block';
}

/* COPY */
function initCommandCopy() {
    document.body.addEventListener('click', function (e) {
        var t = e.target.closest('code[data-copy]');
        if (!t) return;
        e.preventDefault();
        var text = t.getAttribute('data-copy');
        if (!text) return;
        copyToClipboard(text).then(function (ok) { if (ok) showToast('✓ Скопировано: ' + text); });
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
}

var toastTimer = null;
function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
}

/* GUIDE NAV */
function initGuideNav() {
    var nav = document.getElementById('guide-nav');
    if (!nav) return;
    var sections = document.querySelectorAll('.guide-section h2[data-guide-title]');
    sections.forEach(function (h2) {
        var section = h2.closest('.guide-section');
        if (!section) return;
        var a = document.createElement('a');
        a.href = '#' + section.id;
        a.textContent = h2.textContent.trim();
        a.dataset.target = section.id;
        nav.appendChild(a);
    });
    var navLinks = nav.querySelectorAll('a');
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) navLinks.forEach(function (a) { a.classList.toggle('active', a.dataset.target === entry.target.id); });
        });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    sections.forEach(function (h2) {
        var s = h2.closest('.guide-section');
        if (s) observer.observe(s);
    });
    navLinks.forEach(function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            var el = document.getElementById(a.dataset.target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

/* COMMANDS */
var COMMANDS = [
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
    var list = document.getElementById('commands-list');
    if (!list) return;
    list.innerHTML = COMMANDS.map(function (c) {
        return '<div class="command-item"><div class="cmd-name"><code data-copy="' + escapeAttr(c.cmd) + '">' + escapeHtml(c.cmd) + '</code></div><div class="cmd-desc">' + escapeHtml(c.desc) + '</div><div class="cmd-plugin">' + escapeHtml(c.plugin) + '</div></div>';
    }).join('');
    var inp = document.getElementById('cmd-search');
    if (!inp) return;
    inp.addEventListener('input', function () {
        var q = inp.value.trim().toLowerCase();
        document.querySelectorAll('.command-item').forEach(function (item) {
            item.classList.toggle('hidden', q.length > 0 && item.textContent.toLowerCase().indexOf(q) === -1);
        });
    });
}

/* UTILS */
function formatMoney(amount) {
    if (amount == null) return '0';
    if (Math.abs(amount) >= 1000000) return (amount / 1000000).toFixed(2) + 'M';
    if (Math.abs(amount) >= 1000) return (amount / 1000).toFixed(1) + 'k';
    return Math.round(amount).toString();
}

function formatPlaytime(sec) {
    if (sec == null || sec <= 0) return '';
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (d > 0) return h > 0 ? d + 'д ' + h + 'ч' : d + 'д';
    if (h > 0) return m > 0 ? h + 'ч ' + m + 'м' : h + 'ч';
    if (m > 0) return m + 'м';
    return (sec % 60) + 'с';
}

function timeAgo(ts) {
    if (!ts) return '—';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' мин назад';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' ч назад';
    var d = Math.floor(h / 24);
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
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
