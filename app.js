/* Sovereignty panel v4.9 — raw.githubusercontent для JSON + try/catch render */
window.addEventListener('error', function (e) { console.error('[ERR] ' + e.message + ' @' + e.filename + ':' + e.lineno); });
var APP_VERSION = 'v4.9';

/* ============ DATA SOURCES ============ */
var GITHUB_OWNER = 'fjhjfvhfjhk';
var GITHUB_REPO  = 'Sovereignty-panel';
var GITHUB_BRANCH = 'main';
var DATA_RAW_URL = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/data/server1.json';
var DATA_LOCAL_URL = 'data/server1.json';
var MAP_URL = 'data/map.png';
var LOCAL_SKIN_DIR = 'data/skins/';

var SKIN_API = 'https://mc-heads.net', CRAFATAR = 'https://crafatar.com';
var STEVE_UUID = '8667ba71-b85a-4004-af54-457a9734eed7';
var REFRESH_INTERVAL_MS = 300000, LOCAL_SKIN_TIMEOUT_MS = 3000;
var BLOCKS_PER_CHUNK = 16;
var DEFAULT_PIXELS_PER_BLOCK = 1;
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
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(skinImg, 8, 8, 8, 8, 0, 0, 8, 8);
    if (skinImg.width >= 64 && skinImg.height >= 64) ctx.drawImage(skinImg, 40, 8, 8, 8, 0, 0, 8, 8);
    return c.toDataURL('image/png');
}
function getHeadUrl(name, size) {
    if (headCache.has(name)) return headCache.get(name);
    return SKIN_API + '/avatar/' + encodeURIComponent(name) + '/' + (size || 64);
}
function refreshHeadImages() {
    document.querySelectorAll('img[data-pname]').forEach(function (img) {
        var n = img.getAttribute('data-pname');
        if (headCache.has(n)) img.src = headCache.get(n);
    });
}

/* ============ DATA ============ */

/**
 * Загружает JSON. Основной источник — raw.githubusercontent.com
 * (там CDN свежее, чем GitHub Pages/Fastly). При ошибке — fallback
 * на относительный путь data/server1.json.
 */
function loadData() {
    console.log('[Sovereignty] loadData');
    var tbody = document.getElementById('countries-body');
    if (tbody && tbody.children.length <= 1) tbody.innerHTML = '<tr><td colspan="8" class="loading">⏳ Загрузка...</td></tr>';

    var bust = '?t=' + Date.now() + '&v=' + APP_VERSION;
    fetchWithFallback(DATA_RAW_URL + bust, DATA_LOCAL_URL + bust)
        .then(function (text) {
            if (!text || !text.trim()) throw new Error('Пустой файл');
            currentData = JSON.parse(text);

            var updAgo = currentData.updated_at
                ? Math.floor((Date.now() - currentData.updated_at) / 60000) + ' мин назад'
                : '?';
            console.log('[Sovereignty] ok, players: ' + ((currentData.players || []).length) +
                ', online_history: ' + ((currentData.online_history || []).length) +
                ', ppb: ' + (currentData.map_meta && currentData.map_meta.pixels_per_block) +
                ', updated: ' + updAgo);
            safeRender();
            loadMap();
            setTimeout(preloadLocalSkins, 0);
        })
        .catch(function (err) {
            console.error('[Sovereignty] err:', err);
            var sn = document.getElementById('server-name'); if (sn) sn.textContent = '⚠ Ошибка';
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="loading" style="color:#ef4444;">❌ ' + escapeHtml(err.message) + '</td></tr>';
        });
}

/**
 * Пробует первый URL. Если fetch падает (сеть/404/CORS) — пробует второй.
 * Возвращает текст или reject с aggregated error.
 */
function fetchWithFallback(primaryUrl, fallbackUrl) {
    return fetch(primaryUrl, { cache: 'no-store' })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + primaryUrl);
            return r.text();
        })
        .catch(function (primaryErr) {
            console.warn('[Sovereignty] primary failed (' + primaryErr.message + '), trying fallback');
            return fetch(fallbackUrl, { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + fallbackUrl);
                    return r.text();
                })
                .catch(function (fallbackErr) {
                    throw new Error('Оба источника упали: ' + primaryErr.message + ' | ' + fallbackErr.message);
                });
        });
}

/**
 * Оборачивает render() в try/catch, чтобы при ошибке в одном виджете
 * остальные отрисовались, и в консоли было понятное сообщение.
 */
function safeRender() {
    var steps = [
        ['renderCountries',  renderCountries],
        ['renderLegend',     renderLegend],
        ['renderPlayers',    renderPlayers],
        ['renderBonus',      renderBonus],
        ['renderPlayerMarkers', renderPlayerMarkers],
        ['renderMeta',       renderMeta],
        ['drawSparkline',    function () { drawSparkline(currentData.online_history || []); }]
    ];
    for (var i = 0; i < steps.length; i++) {
        try { steps[i][1](); }
        catch (e) { console.error('[Sovereignty] ' + steps[i][0] + ' failed:', e); }
    }
}

function renderMeta() {
    var sn = document.getElementById('server-name'); if (sn) sn.textContent = currentData.server_name || 'Сервер';
    var ob = document.getElementById('online-badge');
    if (ob) ob.textContent = 'Онлайн: ' + (currentData.online_players || 0) + ' / ' + (currentData.max_players || 0);
    var upd = currentData.updated_at;
    if (upd) {
        var m = Math.floor((Date.now() - upd) / 60000);
        var ago = m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : Math.floor(m / 60) + ' ч назад';
        var ub = document.getElementById('updated-badge'); if (ub) ub.textContent = 'Обновлено: ' + ago;
    }
    var countries = currentData.countries || [], players = currentData.players || [];
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
}

function getCountryColor(country) {
    if (!country) return '#6366f1';
    if (country.color) return country.color;
    var h = 0;
    var name = country.name || '';
    for (var i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0; }
    return PALETTE_FALLBACK[Math.abs(h) % PALETTE_FALLBACK.length];
}

function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

/* ============ COUNTRIES TABLE ============ */
function renderCountries() {
    if (!currentData) return;
    var countries = (currentData.countries || []).slice();
    countries.sort(function (a, b) {
        if (currentSort === 'bank') return (b.bank || 0) - (a.bank || 0);
        if (currentSort === 'energy') return (b.energy || 0) - (a.energy || 0);
        if (currentSort === 'allies') return (b.allies || 0) - (a.allies || 0);
        if (currentSort === 'activity') return (b.activity || 0) - (a.activity || 0);
        return (b.claims || 0) - (a.claims || 0);
    });
    var tbody = document.getElementById('countries-body');
    if (!tbody) return;
    if (countries.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="loading">Пока нет стран.</td></tr>'; return; }
    tbody.innerHTML = countries.map(function (c, i) {
        var rc = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
        var color = getCountryColor(c);
        var activity = c.activity || 0;
        var delta = c.claims_delta_7d || 0;
        var deltaHtml = delta > 0 ? '<span style="color:#10b981;">+' + delta + '</span>' :
                        delta < 0 ? '<span style="color:#ef4444;">' + delta + '</span>' :
                        '<span style="color:#8b91a6;">0</span>';
        return '<tr class="' + rc + '" onclick="showDetails(\'' + escapeAttr(c.name) + '\')">' +
            '<td class="rank">#' + (i + 1) + '</td>' +
            '<td class="name"><span class="country-dot" style="background:' + color + ';"></span> ' + escapeHtml(c.name || '?') + '</td>' +
            '<td>' + escapeHtml(c.owner || '?') + '</td>' +
            '<td>' + (c.claims || 0) + ' / ' + (c.max_claims || '?') + ' <span class="delta">(' + deltaHtml + ')</span></td>' +
            '<td class="money">' + formatMoney(c.bank || 0) + '</td>' +
            '<td class="energy">' + (c.energy || 0).toFixed(1) + '</td>' +
            '<td>' + activity + '</td>' +
            '<td>' + (c.pacts || 0) + '</td></tr>';
    }).join('');
}

/* ============ SPARKLINE ============ */
function drawSparkline(history) {
    var canvas = document.getElementById('sparkline-canvas');
    if (!canvas) return;
    var wrap = canvas.parentElement;
    if (!wrap) return;
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth || 800;
    var h = 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, w, h);

    if (!history || history.length < 2) {
        ctx.fillStyle = '#8b91a6';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных за 24 часа', w / 2, h / 2);
        setText('online-now', '0'); setText('online-avg', '0'); setText('online-peak', '0');
        return;
    }

    var maxCount = 1, sum = 0;
    history.forEach(function (h) { if (h.count > maxCount) maxCount = h.count; sum += h.count; });
    var avg = Math.round(sum / history.length);
    var now = history[history.length - 1].count;
    setText('online-now', String(now));
    setText('online-avg', String(avg));
    setText('online-peak', String(maxCount));

    ctx.strokeStyle = '#2a2f3e';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) {
        var y = h - (h / 4) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(99,102,241,0.55)');
    grad.addColorStop(1, 'rgba(99,102,241,0.02)');

    var pts = [];
    var n = history.length;
    var stepX = w / Math.max(1, n - 1);
    history.forEach(function (h, idx) {
        var x = idx * stepX;
        var y = h - (h.count / maxCount) * (h - 20) - 10;
        pts.push({ x: x, y: y });
    });

    ctx.beginPath();
    ctx.moveTo(pts[0].x, h);
    pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
    ctx.lineTo(pts[pts.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    var peakIdx = history.reduce(function (best, h, i, arr) { return h.count > arr[best].count ? i : best; }, 0);
    var peakPt = pts[peakIdx];
    ctx.beginPath();
    ctx.arc(peakPt.x, peakPt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    ctx.fillStyle = '#8b91a6';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Пик ' + maxCount, w - 8, 18);
    ctx.textAlign = 'left';
    ctx.fillText('24ч назад', 8, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText('сейчас', w - 8, h - 6);
}

/* ============ MAP ============ */
function loadMap() {
    var ph = document.getElementById('map-placeholder');
    var canvas = document.getElementById('map-canvas'); if (!canvas) return;
    var img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function () {
        var first = !mapReady;
        mapImage = img;

        if (currentData && currentData.map_meta) {
            var m = currentData.map_meta;
            if (m.img_width && Math.abs(img.naturalWidth - m.img_width) > 2) {
                console.warn('[Map] Width mismatch: png=' + img.naturalWidth + ' meta=' + m.img_width);
            }
            if (m.img_height && Math.abs(img.naturalHeight - m.img_height) > 2) {
                console.warn('[Map] Height mismatch: png=' + img.naturalHeight + ' meta=' + m.img_height);
            }
        }

        setupCanvas(img.naturalWidth, img.naturalHeight);
        mapReady = true;
        if (ph) ph.style.display = 'none';
        canvas.style.display = 'block';
        if (window.MapLayers && currentData && currentData.map_meta) {
            window.MapLayers.onMapReady(img.naturalWidth, img.naturalHeight, currentData.map_meta);
        }
        if (first) setTimeout(resetMapView, 50); else applyMapTransform();
        renderPlayerMarkers();
    };
    img.onerror = function () {
        mapReady = false; canvas.style.display = 'none';
        if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div class="map-placeholder-icon">🗺️</div><p>Карта не сгенерирована.</p>'; }
    };
    img.src = MAP_URL + '?t=' + Date.now() + '&v=' + APP_VERSION;
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
    var vp = document.getElementById('map-viewport'); if (!vp) return;
    vp.addEventListener('mousedown', function (e) {
        if (!mapReady || e.target.closest('.map-marker') || e.target.closest('.map-layers-panel') || e.target.closest('.map-layers-restore')) return;
        isDragging = true; dragMoved = false;
        dragStartX = e.clientX - mapOffsetX; dragStartY = e.clientY - mapOffsetY;
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
        if (!mapReady || dragMoved || e.target.closest('.map-marker') || e.target.closest('.map-layers-panel') || e.target.closest('.map-layers-restore')) return;
        handleMapClick(e);
    });
    vp.addEventListener('wheel', function (e) {
        if (!mapReady) return;
        if (e.target.closest('.map-layers-panel')) return;
        e.preventDefault();
        var rect = vp.getBoundingClientRect();
        var cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        var ix = (cx - mapOffsetX) / mapZoom, iy = (cy - mapOffsetY) / mapZoom;
        mapZoom = Math.max(0.1, Math.min(12, mapZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        mapOffsetX = cx - ix * mapZoom; mapOffsetY = cy - iy * mapZoom;
        applyMapTransform();
    }, { passive: false });
    var rb = document.getElementById('map-reset'); if (rb) rb.addEventListener('click', resetMapView);
    var cb = document.getElementById('map-clear-highlight');
    if (cb) cb.addEventListener('click', function () {
        highlightedCountry = null;
        document.querySelectorAll('.legend-item').forEach(function (el) { el.classList.remove('highlight'); });
        var cd = document.getElementById('country-details'); if (cd) cd.style.display = 'none';
    });
    var sp = document.getElementById('map-show-players');
    if (sp) sp.addEventListener('change', function () {
        showPlayerMarkers = sp.checked;
        if (window.MapLayers) window.MapLayers.getState().players = showPlayerMarkers;
        renderPlayerMarkers();
    });
}

/* ============ FULLSCREEN ============ */
function initMapFullscreen() {
    var btn = document.getElementById('map-fullscreen');
    if (!btn) return;
    btn.addEventListener('click', function () {
        var vp = document.getElementById('map-viewport');
        if (!vp) return;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            var req = vp.requestFullscreen || vp.webkitRequestFullscreen || vp.mozRequestFullScreen;
            if (!req) { showToast('Fullscreen не поддерживается'); return; }
            var promise = req.call(vp);
            if (promise && promise.catch) promise.catch(function (err) {
                showToast('Fullscreen: ' + err.message);
            });
        } else {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        }
    });
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}

function onFullscreenChange() {
    var btn = document.getElementById('map-fullscreen');
    var hint = document.getElementById('map-fullscreen-hint');
    var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (btn) btn.textContent = isFs ? '⛶ Выйти (Esc)' : '⛶ Полный экран';
    if (hint) hint.style.display = isFs ? 'block' : 'none';
    document.body.classList.toggle('map-fullscreen-active', isFs);

    setTimeout(function () {
        if (mapReady) resetMapView();
        if (currentData && currentData.online_history) drawSparkline(currentData.online_history);
        var panel = document.getElementById('map-layers-panel');
        if (panel && window.MapLayers) {
            var visible = window.MapLayers.getState().panelVisible !== false;
            panel.style.display = visible ? '' : 'none';
        }
    }, 120);
}

function handleMapClick(e) {
    var vp = document.getElementById('map-viewport');
    var rect = vp.getBoundingClientRect();
    var cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    var ix = Math.round((cx - mapOffsetX) / mapZoom), iy = Math.round((cy - mapOffsetY) / mapZoom);
    if (ix < 0 || iy < 0 || ix >= mapCanvas.width || iy >= mapCanvas.height) return;
    var px; try { px = mapCtx.getImageData(ix, iy, 1, 1).data; } catch (err) { return; }
    if (px[3] < 10) return;
    var countries = currentData && currentData.countries ? currentData.countries : [];
    var bestIdx = -1, bestDist = 120;
    countries.forEach(function (c, i) {
        var hex = getCountryColor(c).replace('#', '');
        var rgb = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        var d = Math.sqrt(Math.pow(px[0] - rgb[0], 2) + Math.pow(px[1] - rgb[1], 2) + Math.pow(px[2] - rgb[2], 2));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx === -1) return;
    var country = countries[bestIdx];
    highlightCountry(country.name);
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var ov = document.querySelector('.main-nav .nav-btn[data-tab="overview"]'); if (ov) ov.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var ovTab = document.getElementById('tab-overview'); if (ovTab) ovTab.classList.add('active');
    showDetails(country.name);
}

function applyMapTransform() {
    var canvas = document.getElementById('map-canvas'), overlay = document.getElementById('map-overlay');
    if (!canvas) return;
    var t = 'translate(' + mapOffsetX + 'px,' + mapOffsetY + 'px) scale(' + mapZoom + ')';
    canvas.style.transform = t;
    if (overlay) { overlay.style.transform = t; updateMarkerScale(); }
    if (window.MapLayers) window.MapLayers.applyTransform(t);
    var dn = document.getElementById('map-daynight');
    if (dn) dn.style.transform = t;
}

function updateMarkerScale() {
    var overlay = document.getElementById('map-overlay'); if (!overlay) return;
    var z = Math.max(0.05, mapZoom);
    var desired = MARKER_BASE_PX * Math.pow(z, MARKER_GROWTH_POWER);
    var clamped = Math.max(MARKER_MIN_PX, Math.min(MARKER_MAX_PX, desired));
    overlay.style.setProperty('--marker-counter', (clamped / (MARKER_BASE_PX * z)).toFixed(4));
}

function resetMapView() {
    var canvas = document.getElementById('map-canvas'), vp = document.getElementById('map-viewport');
    if (!canvas || !vp || !mapReady) return;
    var vw = vp.clientWidth, vh = vp.clientHeight, iw = mapCanvas.width, ih = mapCanvas.height;
    var scale = Math.min(vw / iw, vh / ih) * 0.98;
    mapZoom = scale;
    mapOffsetX = (vw - iw * scale) / 2; mapOffsetY = (vh - ih * scale) / 2;
    applyMapTransform();
}

function worldToImagePx(x, z, meta) {
    var ppb = (meta && typeof meta.pixels_per_block === 'number' && meta.pixels_per_block > 0)
        ? meta.pixels_per_block
        : DEFAULT_PIXELS_PER_BLOCK;
    return {
        px: (x - meta.min_chunk_x * BLOCKS_PER_CHUNK) * ppb,
        pz: (z - meta.min_chunk_z * BLOCKS_PER_CHUNK) * ppb
    };
}

function renderPlayerMarkers() {
    var overlay = document.getElementById('map-overlay'); if (!overlay) return;
    if (!showPlayerMarkers || !mapReady || !currentData) { overlay.innerHTML = ''; return; }
    var meta = currentData.map_meta, players = currentData.players || [];
    if (!meta || players.length === 0) { overlay.innerHTML = ''; return; }
    var markers = [];
    players.forEach(function (p) {
        var pos = p.position;
        if (!pos || pos.x == null || pos.z == null) return;
        if (pos.world && meta.world && pos.world !== meta.world) return;
        var pt = worldToImagePx(pos.x, pos.z, meta);
        if (pt.px < 0 || pt.pz < 0 || pt.px > mapCanvas.width || pt.pz > mapCanvas.height) return;
        var name = p.name || '?';
        var headUrl = getHeadUrl(name, 32);
        var fallback = SKIN_API + '/avatar/Steve/32';
        var borderColor = p.country_color || '#ffffff';
        var staleClass = pos.stale ? ' stale' : '';
        markers.push('<div class="map-marker ' + (p.online ? 'online' : '') + staleClass + '" style="left:' + pt.px + 'px;top:' + pt.pz + 'px;" onclick="openPlayer(\'' + escapeAttr(name) + '\');event.stopPropagation();" title="' + escapeAttr(name) + (pos.stale ? ' (последняя позиция)' : '') + '">' +
            '<div class="map-marker-content">' +
            '<img class="map-marker-head" style="border-color:' + borderColor + ';" src="' + headUrl + '" data-pname="' + escapeAttr(name) + '" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
            '<div class="map-marker-label">' + escapeHtml(name) + '</div></div></div>');
    });
    overlay.innerHTML = markers.join('');
    updateMarkerScale();
}

/* ============ LEGEND ============ */
function renderLegend() {
    var legend = document.getElementById('map-legend'); if (!legend) return;
    var countries = currentData && currentData.countries ? currentData.countries : [];
    if (countries.length === 0) { legend.innerHTML = ''; return; }
    legend.innerHTML = countries.map(function (c) {
        return '<div class="legend-item" data-country="' + escapeAttr(c.name) + '" onclick="highlightCountry(\'' + escapeAttr(c.name) + '\')">' +
            '<div class="legend-color" style="background:' + getCountryColor(c) + '"></div>' +
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
    var c = countries.filter(function (x) { return x.name === countryName; })[0];
    if (!c) return;
    var dt = document.getElementById('detail-title'); if (dt) dt.textContent = '🏛️ ' + c.name;
    var content = document.getElementById('detail-content'); if (!content) return;
    var items = [
        { label: 'Лидер', value: c.owner || '?' },
        { label: 'Территория', value: (c.claims || 0) + ' / ' + (c.max_claims || '?') + ' чанков' },
        { label: 'Рост 7д', value: (c.claims_delta_7d > 0 ? '+' : '') + (c.claims_delta_7d || 0), cls: c.claims_delta_7d > 0 ? 'success' : (c.claims_delta_7d < 0 ? 'danger' : '') },
        { label: 'Активность', value: c.activity || 0 },
        { label: 'Активных войн', value: c.active_wars || 0, cls: (c.active_wars || 0) > 0 ? 'danger' : '' },
        { label: 'Казна', value: formatMoney(c.bank || 0), cls: 'success' },
        { label: 'Долг', value: formatMoney(c.debt || 0), cls: (c.debt || 0) > 0 ? 'danger' : '' },
        { label: 'Энергия', value: (c.energy || 0).toFixed(1) + ' / ' + (c.max_energy || 0).toFixed(1), cls: 'warning' },
        { label: 'Регенерация', value: (c.regen || 0).toFixed(1) + '/час', cls: 'warning' },
        { label: 'Уровень ферм', value: c.farm_level || 0 },
        { label: 'Союзы', value: c.allies || 0 },
        { label: 'Пакты', value: c.pacts || 0 },
        { label: '🌾 Ферм', value: c.chunks_farm || 0 },
        { label: '⛏ Шахт', value: c.chunks_mining || 0 },
        { label: '⚔ Военных', value: c.chunks_military || 0 },
        { label: '💰 Торговых', value: c.chunks_trade || 0 }
    ];
    content.innerHTML = items.map(function (it) {
        return '<div class="detail-item"><div class="label">' + it.label + '</div>' +
            '<div class="value ' + (it.cls || '') + '">' + escapeHtml(String(it.value)) + '</div></div>';
    }).join('');
    var cd = document.getElementById('country-details');
    if (cd) { cd.style.display = 'block'; cd.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

/* ============ PLAYERS ============ */
function initPlayerControls() {
    var s = document.getElementById('player-search'); if (s) s.addEventListener('input', renderPlayers);
    var o = document.getElementById('player-online-only'); if (o) o.addEventListener('change', renderPlayers);
}

function renderPlayers() {
    var grid = document.getElementById('players-grid'), empty = document.getElementById('players-empty');
    if (!grid || !empty) return;
    var players = currentData && currentData.players ? currentData.players : null;
    if (!players || players.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
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
    if (filtered.length === 0) { grid.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;">Ничего не найдено.</div>'; return; }
    grid.innerHTML = filtered.map(renderPlayerCard).join('');
}

function renderPlayerCard(p) {
    var name = p.name || '?';
    var avatar = getHeadUrl(name, 64);
    var fallback = SKIN_API + '/avatar/Steve/64';
    var badge = '';
    if (p.country_role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
    else if (p.country_role === 'co_ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';
    var pt = formatPlaytime(p.playtime_seconds);
    var money = p.balance != null ? formatMoney(p.balance) : null;
    var countryColor = p.country_color || '#8b91a6';
    return '<div class="player-card" onclick="openPlayer(\'' + escapeAttr(name) + '\')">' + badge +
        '<div class="player-card-avatar">' +
        '<img src="' + avatar + '" data-pname="' + escapeAttr(name) + '" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
        '<div class="status-dot ' + (p.online ? 'online' : 'offline') + '"></div></div>' +
        '<div class="player-card-info">' +
        '<div class="player-card-name">' + escapeHtml(name) + '</div>' +
        '<div class="player-card-country">' + (p.country ? '<span class="country-tag" style="color:' + countryColor + ';">🏛️ ' + escapeHtml(p.country) + '</span>' : '<span class="no-country">Без страны</span>') + '</div>' +
        '<div class="player-card-meta">' +
        (money != null ? '<span class="money">💰 ' + money + '</span>' : '') +
        (pt ? '<span>⏱ ' + pt + '</span>' : '') + '</div></div></div>';
}

function openPlayer(name) {
    var players = currentData && currentData.players ? currentData.players : [];
    var p = players.filter(function (x) { return x.name === name; })[0];
    if (!p) return;
    setText('player-modal-name', name);
    var st = document.getElementById('player-modal-status');
    if (st) {
        st.textContent = p.online ? '● Онлайн' : '○ Оффлайн';
        st.className = 'player-modal-status ' + (p.online ? 'online' : 'offline');
    }
    var acc = [];
    if (p.uuid) acc.push({ label: 'UUID', value: shortenUuid(p.uuid), copy: p.uuid });
    if (p.first_seen) acc.push({ label: 'Первый вход', value: timeAgo(p.first_seen) });
    if (p.last_seen) acc.push({ label: 'Был в игре', value: timeAgo(p.last_seen) });
    if (p.playtime_seconds != null) acc.push({ label: 'Время в игре', value: formatPlaytime(p.playtime_seconds) });

    var eco = [];
    if (p.balance != null) eco.push({ label: 'Баланс', value: formatMoney(p.balance), cls: 'success' });
    if (p.job) eco.push({ label: 'Профессия', value: p.job + (p.job_level ? ' (ур. ' + p.job_level + ')' : '') });
    if (p.kills != null || p.deaths != null) {
        var k = p.kills || 0, d = p.deaths || 0;
        eco.push({ label: 'Убийств', value: k });
        eco.push({ label: 'Смертей', value: d });
        eco.push({ label: 'K/D', value: d > 0 ? (k / d).toFixed(2) : k });
    }

    var cR = [];
    if (p.country) {
        cR.push({ label: 'Название', value: p.country, cls: 'accent', copy: p.country });
        if (p.country_role) cR.push({ label: 'Роль', value: p.country_role === 'leader' ? 'Лидер' : p.country_role === 'co_ruler' ? 'Соправитель' : p.country_role });
        var cd = (currentData.countries || []).filter(function (c) { return c.name === p.country; })[0];
        if (cd) {
            if (cd.bank != null) cR.push({ label: 'Казна страны', value: formatMoney(cd.bank) });
            if (cd.claims != null) cR.push({ label: 'Территория', value: cd.claims + ' чанков' });
            if (cd.activity != null) cR.push({ label: 'Активность', value: cd.activity });
        }
    } else cR.push({ label: 'Страна', value: 'Нет' });

    var aR = [];
    if (p.energy != null) aR.push({ label: 'Энергия', value: p.energy.toFixed(1) + (p.max_energy != null ? ' / ' + p.max_energy.toFixed(1) : ''), cls: 'warning' });
    if (p.achievements_count != null) aR.push({ label: 'Достижений', value: p.achievements_count });
    if (p.position) {
        var staleNote = p.position.stale ? ' §7(последняя)' : '';
        aR.push({ label: 'Локация', value: Math.round(p.position.x) + ', ' + Math.round(p.position.y || 0) + ', ' + Math.round(p.position.z) + staleNote });
    }

    var panel = document.getElementById('player-modal-panels');
    if (panel) panel.innerHTML = renderPanel('Учётная запись', acc) + renderPanel('Экономика', eco) + renderPanel('Страна', cR) + renderPanel('Активность', aR);

    var actions = [];
    if (p.country) actions.push('<button class="player-modal-btn" onclick="gotoCountry(\'' + escapeAttr(p.country) + '\')">🏛️ Перейти к стране</button>');
    if (p.position) actions.push('<button class="player-modal-btn" onclick="gotoPlayerOnMap(\'' + escapeAttr(name) + '\')">🗺️ На карте</button>');
    actions.push('<button class="player-modal-btn" onclick="copyToClipboardSafe(\'' + escapeAttr(name) + '\')">📋 Скопировать ник</button>');
    var ab = document.getElementById('player-modal-actions'); if (ab) ab.innerHTML = actions.join('');

    openPlayerModal();
    setTimeout(function () { initSkinViewer(name, p.uuid); }, 60);
}

function renderPanel(title, rows) {
    var valid = (rows || []).filter(function (r) { return r.value !== undefined && r.value !== null && r.value !== ''; });
    if (valid.length === 0) return '';
    return '<div class="player-panel"><div class="player-panel-title">' + escapeHtml(title) + '</div>' +
        valid.map(function (r) {
            var cp = r.copy ? '<button class="player-copy-btn" onclick="copyToClipboardSafe(\'' + escapeAttr(r.copy) + '\')">📋</button>' : '';
            return '<div class="player-panel-row"><div class="row-label">' + escapeHtml(r.label) + '</div>' +
                '<div class="row-value ' + (r.cls || '') + '">' + escapeHtml(String(r.value)) + '</div>' + cp + '</div>';
        }).join('') + '</div>';
}

/* ============ 3D VIEWER ============ */
function resolveSkinUrl(name, uuid) {
    if (localSkinCache.has(name)) return LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
    if (uuid) return CRAFATAR + '/skins/' + uuid.replace(/-/g, '') + '?default=MHF_Steve';
    return CRAFATAR + '/skins/' + STEVE_UUID + '?default=MHF_Steve';
}
function isLocalUrl(url) { return url.indexOf(LOCAL_SKIN_DIR) === 0 || url.indexOf('data:') === 0; }

function initSkinViewer(name, uuid) {
    var wrap = document.getElementById('player-viewer-wrap'); if (!wrap) return;
    if (currentSkinViewer) { try { currentSkinViewer.dispose(); } catch (e) {} currentSkinViewer = null; }
    var loading = document.getElementById('skin-loading');
    if (loading) { loading.classList.remove('hidden'); loading.innerHTML = '<div class="spinner"></div><div>Загрузка скина...</div>'; }
    if (typeof SkinViewer3D === 'undefined') {
        if (loading) loading.innerHTML = '<div style="padding:20px;color:#ef4444;">skin3d.js не подключён</div>';
        return;
    }
    var url = resolveSkinUrl(name, uuid);
    var img = new Image();
    if (!isLocalUrl(url)) img.crossOrigin = 'anonymous';
    img.onload = function () {
        try {
            var state = SkinViewer3D.build(img, name, wrap);
            state.autoRotate = !rotatePaused;
            currentSkinViewer = state;
            bindSkinControls(state);
            if (loading) loading.classList.add('hidden');
        } catch (err) {
            if (loading) loading.innerHTML = '<div style="padding:20px;color:#ef4444;">Ошибка: ' + escapeHtml(err.message) + '</div>';
        }
    };
    img.onerror = function () { if (loading) loading.innerHTML = '<div style="padding:20px;color:#ef4444;text-align:center;">Скин не загрузился</div>'; };
    img.src = url;
}

function bindSkinControls(state) {
    var sc = state.scene, drag = false, lx = 0, ly = 0;
    sc.addEventListener('mousedown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; sc.style.cursor = 'grabbing'; e.preventDefault(); });
    window.addEventListener('mousemove', function (e) {
        if (!drag || currentSkinViewer !== state) return;
        state.rotation += (e.clientX - lx) * 0.7;
        state.rotationX += (e.clientY - ly) * 0.3;
        if (state.rotationX > 30) state.rotationX = 30;
        if (state.rotationX < -30) state.rotationX = -30;
        lx = e.clientX; ly = e.clientY;
        state.apply();
    });
    window.addEventListener('mouseup', function () { if (drag) { drag = false; sc.style.cursor = 'grab'; } });
}

/* ============ NAV ============ */
function gotoCountry(name) {
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var ov = document.querySelector('.main-nav .nav-btn[data-tab="overview"]'); if (ov) ov.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var t = document.getElementById('tab-overview'); if (t) t.classList.add('active');
    highlightCountry(name); showDetails(name);
}

function gotoPlayerOnMap(name) {
    var players = currentData && currentData.players ? currentData.players : [];
    var p = players.filter(function (x) { return x.name === name; })[0];
    if (!p || !p.position || !currentData.map_meta) return;
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var mp = document.querySelector('.main-nav .nav-btn[data-tab="map"]'); if (mp) mp.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    var t = document.getElementById('tab-map'); if (t) t.classList.add('active');
    setTimeout(function () {
        if (!mapReady) return;
        var pt = worldToImagePx(p.position.x, p.position.z, currentData.map_meta);
        var vp = document.getElementById('map-viewport');
        mapZoom = 1.5;
        mapOffsetX = vp.clientWidth / 2 - pt.px * mapZoom;
        mapOffsetY = vp.clientHeight / 2 - pt.pz * mapZoom;
        applyMapTransform();
    }, 80);
}

function copyToClipboardSafe(text) { copyToClipboard(text).then(function (ok) { if (ok) showToast('✓ Скопировано: ' + text); }); }

/* ============ BONUS ============ */
function renderBonus() {
    if (!currentData) return;
    var jp = currentData.jackpot;
    var jpEl = document.getElementById('panel-jackpot');
    if (jpEl) {
        if (jp != null && jp > 0) { jpEl.style.display = 'block'; setText('jackpot-value', formatMoney(jp)); }
        else jpEl.style.display = 'none';
    }
    var ev = currentData.events || [];
    var ep = document.getElementById('panel-events');
    if (ep) {
        if (ev.length > 0) {
            ep.style.display = 'block';
            document.getElementById('events-list').innerHTML = ev.map(function (e) {
                return '<div class="event-item ' + (e.type === 'negative' ? 'negative' : 'positive') + '"><div><div class="name">' + escapeHtml(e.name || e.id || '?') + '</div><div class="desc">' + escapeHtml(e.description || '') + '</div></div></div>';
            }).join('');
        } else ep.style.display = 'none';
    }
    var wr = currentData.wars || [];
    var wp = document.getElementById('panel-wars');
    if (wp) {
        if (wr.length > 0) {
            wp.style.display = 'block';
            document.getElementById('wars-list').innerHTML = wr.map(function (w) {
                return '<div class="war-item"><div><div class="name">' + escapeHtml(w.attacker) + ' ⚔ ' + escapeHtml(w.defender) + '</div><div class="desc">С ' + formatDate(w.started_at) + '</div></div></div>';
            }).join('');
        } else wp.style.display = 'none';
    }
    var pk = currentData.top_poker || [];
    var pp = document.getElementById('panel-poker');
    if (pp) {
        if (pk.length > 0) {
            pp.style.display = 'block';
            document.getElementById('poker-body').innerHTML = pk.map(function (p, i) {
                return '<tr><td class="rank">#' + (i + 1) + '</td><td class="name">' + escapeHtml(p.name || '?') + '</td><td class="' + (p.profit >= 0 ? 'money' : '') + '">' + (p.profit >= 0 ? '+' : '') + formatMoney(p.profit || 0) + '</td><td>' + (p.hands || 0) + '</td></tr>';
            }).join('');
        } else pp.style.display = 'none';
    }
    var bn = currentData.bounties || [];
    var bp = document.getElementById('panel-bounties');
    if (bp) {
        if (bn.length > 0) {
            bp.style.display = 'block';
            document.getElementById('bounties-list').innerHTML = bn.map(function (b) {
                return '<div class="bounty-item"><div><div class="name">' + escapeHtml(b.target || '?') + '</div><div class="desc">Награда: ' + formatMoney(b.amount || 0) + '</div></div></div>';
            }).join('');
        } else bp.style.display = 'none';
    }
    var any = (jp > 0) || ev.length > 0 || wr.length > 0 || pk.length > 0 || bn.length > 0;
    var be = document.getElementById('panel-bonus-empty'); if (be) be.style.display = any ? 'none' : 'block';
}

/* ============ COPY / TOAST ============ */
function initCommandCopy() {
    document.body.addEventListener('click', function (e) {
        var t = e.target.closest('code[data-copy]'); if (!t) return;
        e.preventDefault();
        var text = t.getAttribute('data-copy'); if (!text) return;
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
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
}
var toastTimer = null;
function showToast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
}

/* ============ GUIDE NAV ============ */
function initGuideNav() {
    var nav = document.getElementById('guide-nav'); if (!nav) return;
    var sections = document.querySelectorAll('.guide-section h2[data-guide-title]');
    sections.forEach(function (h2) {
        var s = h2.closest('.guide-section'); if (!s) return;
        var a = document.createElement('a');
        a.href = '#' + s.id; a.textContent = h2.textContent.trim(); a.dataset.target = s.id;
        nav.appendChild(a);
    });
    var links = nav.querySelectorAll('a');
    var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('active', a.dataset.target === e.target.id); });
        });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    sections.forEach(function (h2) { var s = h2.closest('.guide-section'); if (s) obs.observe(s); });
    links.forEach(function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            var el = document.getElementById(a.dataset.target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

/* ============ COMMANDS ============ */
var COMMANDS = [
    { cmd: '/c', desc: 'Меню страны', plugin: 'Sovereignty' },
    { cmd: '/c create МояСтрана', desc: 'Создать страну', plugin: 'Sovereignty' },
    { cmd: '/c claim', desc: 'Захватить чанк', plugin: 'Sovereignty' },
    { cmd: '/c unclaim', desc: 'Освободить чанк', plugin: 'Sovereignty' },
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
    { cmd: '/c panel cache reset', desc: 'Сброс кэша карты', plugin: 'Sovereignty' },
    { cmd: '/tax', desc: 'Налоги', plugin: 'TaxCollector' },
    { cmd: '/shop', desc: 'Рынок', plugin: 'MarketGUI' },
    { cmd: '/auc', desc: 'Аукцион', plugin: 'AuctionHouse' },
    { cmd: '/bounty Steve 5000', desc: 'Награда', plugin: 'Bounty' },
    { cmd: '/roll', desc: 'Казино', plugin: 'RollGame' },
    { cmd: '/roll slots 1000', desc: 'Слоты', plugin: 'RollGame' },
    { cmd: '/roll crash 1000', desc: 'Crash', plugin: 'RollGame' },
    { cmd: '/roll upgrade', desc: 'Апгрейдер', plugin: 'RollGame' },
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
    var list = document.getElementById('commands-list'); if (!list) return;
    list.innerHTML = COMMANDS.map(function (c) {
        return '<div class="command-item"><div class="cmd-name"><code data-copy="' + escapeAttr(c.cmd) + '">' + escapeHtml(c.cmd) + '</code></div><div class="cmd-desc">' + escapeHtml(c.desc) + '</div><div class="cmd-plugin">' + escapeHtml(c.plugin) + '</div></div>';
    }).join('');
    var inp = document.getElementById('cmd-search'); if (!inp) return;
    inp.addEventListener('input', function () {
        var q = inp.value.trim().toLowerCase();
        document.querySelectorAll('.command-item').forEach(function (item) {
            item.classList.toggle('hidden', q.length > 0 && item.textContent.toLowerCase().indexOf(q) === -1);
        });
    });
}

/* ============ UTILS ============ */
function formatMoney(a) {
    if (a == null) return '0';
    if (Math.abs(a) >= 1000000) return (a / 1000000).toFixed(2) + 'M';
    if (Math.abs(a) >= 1000) return (a / 1000).toFixed(1) + 'k';
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
    if (!ts) return '—';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    var m = Math.floor(s / 60); if (m < 60) return m + ' мин назад';
    var h = Math.floor(m / 60); if (h < 24) return h + ' ч назад';
    var d = Math.floor(h / 24); if (d < 30) return d + ' дн назад';
    return Math.floor(d / 30) + ' мес назад';
}
function formatDate(ts) { return ts ? new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
function shortenUuid(u) { return !u ? '—' : (u.length > 13 ? u.substring(0, 8) + '…' : u); }
function escapeHtml(s) { if (s == null) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
function escapeAttr(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
