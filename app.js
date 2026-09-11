/**
 * Панель Sovereignty — полный скрипт.
 *
 * Версия v2.5:
 *   - Скины 3D: только Crafatar (CORS-friendly) + локальные файлы
 *   - Прокси-источники убраны как нерабочие
 *   - Голова игрока на карте: counter-scale (растёт при zoom-in, уменьшается при zoom-out)
 *   - Камера и свет — из v2.4
 */

const DATA_URL = 'data/server1.json';
const MAP_URL = 'data/map.png';
const LOCAL_SKIN_DIR = 'data/skins/';
const SKIN_API = 'https://mc-heads.net'; // для аватарок (img, без CORS)
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

const PALETTE = [
    '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
    '#a855f7', '#f43f5e', '#22d3ee', '#a3e635', '#facc15',
    '#fb923c', '#e879f9', '#4ade80', '#60a5fa', '#fca5a5'
];

// ==================== INIT ====================

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

        document.getElementById('refresh-btn').onclick = () => {
            loadData();
            loadMap();
        };

        loadData();
        setInterval(loadData, REFRESH_INTERVAL_MS);
    } catch (e) {
        console.error('[Sovereignty] Ошибка инициализации:', e);
    }
});

function initTabs() {
    document.querySelectorAll('.main-nav .nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById('tab-' + tab);
            if (target) target.classList.add('active');
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
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayerModal();
    });

    const rotBtn = document.getElementById('skin-toggle-rotate');
    if (rotBtn) rotBtn.onclick = () => {
        rotatePaused = !rotatePaused;
        rotBtn.textContent = rotatePaused ? '▶ Пуск' : '⏸ Пауза';
        rotBtn.classList.toggle('active', rotatePaused);
    };

    const resetBtn = document.getElementById('skin-reset-view');
    if (resetBtn) resetBtn.onclick = () => {
        if (!currentSkinViewer) return;
        applyDefaultCamera(currentSkinViewer);
    };

    const nameBtn = document.getElementById('skin-toggle-name');
    if (nameBtn) nameBtn.onclick = () => {
        if (!currentSkinViewer || !currentSkinViewer.nameTag) return;
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
    if (currentSkinViewer) {
        try { currentSkinViewer.dispose(); } catch (e) {}
        currentSkinViewer = null;
    }
    currentRotateAnim = null;
    rotatePaused = false;
    const btn = document.getElementById('skin-toggle-rotate');
    if (btn) { btn.textContent = '⏸ Пауза'; btn.classList.remove('active'); }
}

// ==================== DATA ====================

async function loadData() {
    const tbody = document.getElementById('countries-body');
    if (tbody && tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">⏳ Загрузка данных...</td></tr>';
    }

    try {
        const response = await fetch(DATA_URL + '?t=' + Date.now());
        if (!response.ok) throw new Error(`HTTP ${response.status} — файл не найден`);
        const text = await response.text();
        if (!text || !text.trim()) throw new Error('Пустой файл');
        currentData = JSON.parse(text);
        render();
        loadMap();
    } catch (err) {
        console.error('[Sovereignty] Ошибка загрузки:', err);
        document.getElementById('server-name').textContent = '⚠ Ошибка';
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="loading" style="text-align:left;padding:20px;color:#ef4444;">
                <strong>❌ Не удалось загрузить данные</strong><br><br>
                <strong>Причина:</strong> ${escapeHtml(err.message)}<br><br>
                Проверьте: <a href="${DATA_URL}" target="_blank" style="color:#818cf8;">${DATA_URL}</a>
            </td></tr>`;
        }
    }
}

function render() {
    if (!currentData) return;

    document.getElementById('server-name').textContent = currentData.server_name || 'Сервер';
    document.getElementById('online-badge').textContent =
        `Онлайн: ${currentData.online_players || 0} / ${currentData.max_players || 0}`;

    const updated = currentData.updated_at;
    if (updated) {
        const m = Math.floor((Date.now() - updated) / 60000);
        const ago = m < 1 ? 'только что' : m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч назад`;
        document.getElementById('updated-badge').textContent = `Обновлено: ${ago}`;
    }

    const countries = currentData.countries || [];
    const players = currentData.players || [];

    document.getElementById('countries-count').textContent = countries.length;
    document.getElementById('total-claims').textContent =
        countries.reduce((s, c) => s + (c.claims || 0), 0).toLocaleString('ru-RU');
    document.getElementById('total-bank').textContent =
        formatMoney(countries.reduce((s, c) => s + (c.bank || 0), 0));
    document.getElementById('total-energy').textContent =
        countries.reduce((s, c) => s + (c.energy || 0), 0).toFixed(1);

    const tp = document.getElementById('total-players');
    if (tp) {
        if (players.length > 0) {
            const online = players.filter(p => p.online).length;
            tp.textContent = online > 0 ? `${online} / ${players.length}` : `${players.length}`;
        } else {
            tp.textContent = `${currentData.online_players || 0}`;
        }
    }

    renderCountries();
    renderLegend();
    renderPlayers();
    renderBonus();
    renderPlayerMarkers();
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
    if (countries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Пока нет стран.</td></tr>';
        return;
    }

    tbody.innerHTML = countries.map((c, i) => {
        const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
        return `<tr class="${rankClass}" onclick="showDetails('${escapeAttr(c.name)}')">
            <td class="rank">#${i + 1}</td>
            <td class="name">${escapeHtml(c.name || '?')}</td>
            <td>${escapeHtml(c.owner || '?')}</td>
            <td>${c.claims || 0} / ${c.max_claims || '?'}</td>
            <td class="money">${formatMoney(c.bank || 0)}</td>
            <td class="energy">${(c.energy || 0).toFixed(1)}</td>
            <td>${c.allies || 0}</td>
            <td>${c.pacts || 0}</td>
        </tr>`;
    }).join('');
}

function renderLegend() {
    const legend = document.getElementById('map-legend');
    if (!legend) return;
    const countries = currentData?.countries || [];
    if (countries.length === 0) { legend.innerHTML = ''; return; }
    legend.innerHTML = countries.map((c, i) => `
        <div class="legend-item" data-country="${escapeAttr(c.name)}" onclick="highlightCountry('${escapeAttr(c.name)}')">
            <div class="legend-color" style="background:${PALETTE[i % PALETTE.length]}"></div>
            <span>${escapeHtml(c.name)}</span>
        </div>
    `).join('');
}

function highlightCountry(name) {
    highlightedCountry = highlightedCountry === name ? null : name;
    document.querySelectorAll('.legend-item').forEach(el => {
        el.classList.toggle('highlight', el.dataset.country === highlightedCountry);
    });
    if (highlightedCountry) showDetails(highlightedCountry);
}

function showDetails(countryName) {
    const country = (currentData?.countries || []).find(c => c.name === countryName);
    if (!country) return;
    document.getElementById('detail-title').textContent = '🏛️ ' + country.name;
    const content = document.getElementById('detail-content');
    const items = [
        { label: 'Лидер', value: country.owner || '?', cls: '' },
        { label: 'Территория', value: `${country.claims || 0} / ${country.max_claims || '?'} чанков` },
        { label: 'Казна', value: formatMoney(country.bank || 0), cls: 'success' },
        { label: 'Долг', value: formatMoney(country.debt || 0), cls: (country.debt || 0) > 0 ? 'danger' : '' },
        { label: 'Энергия', value: `${(country.energy || 0).toFixed(1)} / ${(country.max_energy || 0).toFixed(1)}`, cls: 'warning' },
        { label: 'Регенерация', value: `${(country.regen || 0).toFixed(1)}/час`, cls: 'warning' },
        { label: 'Уровень ферм', value: country.farm_level || 0 },
        { label: 'Союзы', value: country.allies || 0 },
        { label: 'Пакты', value: country.pacts || 0 },
        { label: '🌾 Ферм', value: country.chunks_farm || 0 },
        { label: '⛏ Шахт', value: country.chunks_mining || 0 },
        { label: '⚔ Военных', value: country.chunks_military || 0 },
        { label: '💰 Торговых', value: country.chunks_trade || 0 }
    ];
    content.innerHTML = items.map(it => `
        <div class="detail-item">
            <div class="label">${it.label}</div>
            <div class="value ${it.cls || ''}">${escapeHtml(String(it.value))}</div>
        </div>
    `).join('');
    document.getElementById('country-details').style.display = 'block';
    document.getElementById('country-details').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==================== MAP ====================

function loadMap() {
    const placeholder = document.getElementById('map-placeholder');
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const firstLoad = !mapReady;
        mapImage = img;
        setupCanvas(img.naturalWidth, img.naturalHeight);
        mapReady = true;
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        if (firstLoad) setTimeout(resetMapView, 50);
        else applyMapTransform();
        renderPlayerMarkers();
    };
    img.onerror = () => {
        mapReady = false;
        canvas.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<div class="map-placeholder-icon">🗺️</div>
            <p>Карта ещё не сгенерирована.</p>
            <p style="font-size:12px;margin-top:8px;">Файл: <a href="${MAP_URL}" target="_blank" style="color:#818cf8;">${MAP_URL}</a></p>`;
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
    const viewport = document.getElementById('map-viewport');
    if (!viewport) return;

    viewport.addEventListener('mousedown', (e) => {
        if (!mapReady || e.target.closest('.map-marker')) return;
        isDragging = true; dragMoved = false;
        dragStartX = e.clientX - mapOffsetX;
        dragStartY = e.clientY - mapOffsetY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStartX;
        const newY = e.clientY - dragStartY;
        if (Math.abs(newX - mapOffsetX) > 3 || Math.abs(newY - mapOffsetY) > 3) dragMoved = true;
        mapOffsetX = newX; mapOffsetY = newY;
        applyMapTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    viewport.addEventListener('click', (e) => {
        if (!mapReady || dragMoved || e.target.closest('.map-marker')) return;
        handleMapClick(e);
    });

    viewport.addEventListener('wheel', (e) => {
        if (!mapReady) return;
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const cX = e.clientX - rect.left, cY = e.clientY - rect.top;
        const iX = (cX - mapOffsetX) / mapZoom, iY = (cY - mapOffsetY) / mapZoom;
        const delta = e.deltaY > 0 ? 0.9 : 
