/* Sovereignty panel v4.8 — chunk 16×16 (ppb=1) */
window.addEventListener('error', function (e) { console.error('[ERR] ' + e.message + ' @' + e.filename + ':' + e.lineno); });
var APP_VERSION = 'v4.8';
var DATA_URL = 'data/server1.json', MAP_URL = 'data/map.png', LOCAL_SKIN_DIR = 'data/skins/';
var SKIN_API = 'https://mc-heads.net', CRAFATAR = 'https://crafatar.com';
var STEVE_UUID = '8667ba71-b85a-4004-af54-457a9734eed7';
var REFRESH_INTERVAL_MS = 300000, LOCAL_SKIN_TIMEOUT_MS = 3000;
var BLOCKS_PER_CHUNK = 16;
var DEFAULT_PIXELS_PER_BLOCK = 1;   // fallback для старого JSON без map_meta.pixels_per_block
var MARKER_BASE_PX = 32, MARKER_MIN_PX = 18, MARKER_MAX_PX = 72, MARKER_GROWTH_POWER = 0.5;
var PALETTE_FALLBACK = ['#6366f1','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4'];

var currentData = null, currentSort = 'claims';
var mapZoom = 1, mapOffsetX = 0, mapOffsetY = 0;
var isDragging = false, dragStartX = 0, dragStartY = 0, dragMoved = false;
var highlightedCountry = null, showPlayerMarkers = true;
var mapImage = null, mapCanvas = null, mapCtx = null, mapReady = false;
var currentSkinViewer = null, rotatePaused = true;
var localSkinCache = new Map(), headCache = new Map(), localLoadedAttempted = new Set();

document.addEventListener('DOMContentLoaded', function () {
    console.log('[Sovereignty] ' + APP_VERSION + ' DOMContentLoaded');
    ['initTabs','initSortTabs','initMapControls','initMapFullscreen','initCommandCopy','initGuideNav',
     'initCommandSearch','initPlayerControls','initModalControls'].forEach(function (fn) {
        try { window[fn](); } catch (e) { console.error(fn + ':', e); }
    });
    var rb = document.getElementById('refresh-btn');
    if (rb) rb.onclick = function () { loadData(); loadMap(); };
    loadData();
    setInterval(loadData, REFRESH_INTERVAL_MS);
    requestAnimationFrame(skinRotateLoop);
    window.addEventListener('resize', debounce(function () {
        if (currentData && currentData.online_history) drawSparkline(currentData.online_history);
        if (mapReady) applyMapTransform();
    }, 200));
});

function debounce(fn, ms) {
    var t = null;
    return function () {
        var args = arguments, ctx = this;
        if (t) clearTimeout(t);
        t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
}

function skinRotateLoop() {
    if (currentSkinViewer && currentSkinViewer.autoRotate) {
        currentSkinViewer.rotation += 0.8;
        currentSkinViewer.apply();
    }
    requestAnimationFrame(skinRotateLoop);
}

/* ============ TABS ============ */
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
            if (tab === 'overview' && currentData && currentData.online_history) setTimeout(function () { drawSparkline(currentData.online_history); }, 60);
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

/* ============ MODAL ============ */
function initModalControls() {
    document.querySelectorAll('[data-modal-close]').forEach(function (el) {
        el.addEventListener('click', function () { closePlayerModal(); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePlayerModal(); });
    var rotBtn = document.getElementById('skin-toggle-rotate');
    if (rotBtn) {
        updateRotateButton(rotBtn);
        rotBtn.onclick = function () {
            rotatePaused = !rotatePaused;
            if (currentSkinViewer) currentSkinViewer.autoRotate = !rotatePaused;
            updateRotateButton(rotBtn);
        };
    }
    var resetBtn = document.getElementById('skin-reset-view');
    if (resetBtn) resetBtn.onclick = function () {
        if (currentSkinViewer) { currentSkinViewer.rotation = 0; currentSkinViewer.rotationX = 0; currentSkinViewer.apply(); showToast('✓ Вид сброшен'); }
    };
    var nameBtn = document.getElementById('skin-toggle-name');
    if (nameBtn) nameBtn.onclick = function () {
        var tag = document.getElementById('skin-nametag');
        if (tag) tag.style.display = tag.style.display === 'none' ? 'block' : 'none';
    };
}

function updateRotateButton(btn) {
    if (!btn) return;
    if (rotatePaused) { btn.textContent = '▶ Вращение'; btn.classList.add('active'); }
    else { btn.textContent = '⏸ Пауза'; btn.classList.remove('active'); }
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
    rotatePaused = true;
    var btn = document.getElementById('skin-toggle-rotate');
    if (btn) updateRotateButton(btn);
}

/* ============ LOCAL SKINS ============ */
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
            if (done === toLoad.length) { console.log('[Skins] ' + loaded + '/' + toLoad.length); refreshHeadImages(); }
        });
    });
}
function loadLocalSkin(name) {
    if (localSkinCache.has(name)) return Promise.resolve(localSkinCache.get(name));
    var url = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
    return new Promise(function (resolve, reject) {
        var img = new Image(), fin = false;
        var timer = setTimeout(function () { if (fin) return; fin = true; img.src = ''; reject(new Error('timeout')); }, LOCAL_SKIN_TIMEOUT_MS);
        img.onload = function () {
            if (fin) return; fin = true; clearTimeout(timer);
            if (img.width < 64 || (img.height !== 32 && img.height !== 64)) { reject(new Error('bad')); return; }
            localSkinCache.set(name, img);
            try { headCache.set(name, headFromSkin(img)); } catch (e) {}
            resolve(img);
        };
        img.onerror = function () { if (fin) return; fin = true; clearTimeout(timer); reject(new Error('404')); };
        img.src = url;
    });
}
function headFromSkin(skinImg) {
    var c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    var ctx = c.getContext('2d');
    ctx.image
