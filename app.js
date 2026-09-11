/**
 * Веб-панель Sovereignty.
 *
 * Возможности:
 *   - табы: Обзор / Карта / Игроки / Гайд / Команды / Бонусы
 *   - интерактивная карта (pan + zoom + click по стране через canvas)
 *   - маркеры игроков на карте (голова + ник)
 *   - 3D-модель игрока в модалке (skinview3d, можно крутить мышью)
 *   - копирование команд в буфер
 *   - условные секции Бонусов
 *
 * Скины:
 *   1) Сначала пробуем локальный файл  data/skins/{name}.png
 *      (для пираток — админ кладёт свои PNG вручную)
 *   2) Если нет — mc-heads.net/skin/{name} (лицензия)
 *   3) Если и там нет — Steve
 */

const DATA_URL = 'data/server1.json';
const MAP_URL = 'data/map.png';
const LOCAL_SKIN_DIR = 'data/skins/';
const SKIN_API = 'https://mc-heads.net';
const REFRESH_INTERVAL_MS = 60 * 1000; // 1 минута — чтобы позиции были актуальны

// Размеры берём из плагина TerrainRenderer
const IMG_SIZE_PER_CHUNK = 32;   // PIXELS_PER_BLOCK(2) × CHUNK_SIZE(16)
const BLOCKS_PER_CHUNK = 16;
const PIXELS_PER_BLOCK = 2;

let currentData = null;
let currentSort = 'claims';
let mapZoom = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;
let highlightedCountry = null;
let showPlayerMarkers = true;

let mapImage = null;
let mapCanvas = null;
let mapCtx = null;
let mapReady = false;

// Текущий viewer (skinview3d) — уничтожаем при закрытии модалки
let currentSkinViewer = null;
let currentRotateAnim = null;
let currentNameTag = null;
let rotatePaused = false;

const PALETTE = [
    '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
    '#a855f7', '#f43f5e', '#22d3ee', '#a3e635', '#facc15',
    '#fb923c', '#e879f9', '#4ade80', '#60a5fa', '#fca5a5'
];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', () => {
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

            if (tab === 'map' && mapReady) {
                setTimeout(resetMapView, 50);
            }
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

    document.getElementById('skin-toggle-rotate').onclick = () => {
        rotatePaused = !rotatePaused;
        const btn = document.getElementById('skin-toggle-rotate');
        btn.textContent = rotatePaused ? '▶ Пуск' : '⏸ Пауза';
        btn.classList.toggle('active', rotatePaused);
    };

    document.getElementById('skin-reset-view').onclick = () => {
        if (!currentSkinViewer) return;
        currentSkinViewer.camera.position.set(20, 25, 40);
        currentSkinViewer.camera.lookAt(0, 15, 0);
    };

    document.getElementById('skin-toggle-name').onclick = () => {
        if (!currentSkinViewer) return;
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

    // Уничтожаем 3D-сцену, чтобы не жрала ресурсы
    if (currentSkinViewer) {
        try { currentSkinViewer.dispose(); } catch (e) { /* ignore */ }
        currentSkinViewer = null;
    }
    currentRotateAnim = null;
    currentNameTag = null;
    rotatePaused = false;
    const btn = document.getElementById('skin-toggle-rotate');
    if (btn) { btn.textContent = '⏸ Пауза'; btn.classList.remove('active'); }
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================

async function loadData() {
    const tbody = document.getElementById('countries-body');
    if (tbody && tbody.children.length <= 1) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">⏳ Загрузка данных...</td></tr>';
    }

    try {
        const url = DATA_URL + '?t=' + Date.now();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} — файл data/server1.json не найден.`);
        const text = await response.text();
        if (!text || text.trim().length === 0) throw new Error('Файл data/server1.json пустой.');

        try {
            currentData = JSON.parse(text);
        } catch (parseErr) {
            throw new Error('Ошибка парсинга JSON: ' + parseErr.message);
        }

        render();
        loadMap();
    } catch (err) {
        console.error('[Sovereignty] Ошибка:', err);
        document.getElementById('server-name').textContent = '⚠ Ошибка загрузки';
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="8" class="loading" style="text-align:left;padding:20px;color:#ef4444;">
                    <strong>❌ Не удалось загрузить данные</strong><br><br>
                    <strong>Причина:</strong> ${escapeHtml(err.message)}<br><br>
                    Проверьте: <a href="${DATA_URL}" target="_blank" style="color:#818cf8;">${DATA_URL}</a>
                </td></tr>
            `;
        }
    }
}

// ==================== КАРТА ====================

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
        // Сбрасываем вид только при первой загрузке; иначе — сохраняем
        if (firstLoad) setTimeout(resetMapView, 50);
        else applyMapTransform();
        renderPlayerMarkers();
    };
    img.onerror = () => {
        mapReady = false;
        canvas.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerHTML = `
            <div class="map-placeholder-icon">🗺️</div>
            <p>Карта ещё не сгенерирована.</p>
            <p style="font-size:12px;margin-top:8px;">Файл: <a href="${MAP_URL}" target="_blank" style="color:#818cf8;">${MAP_URL}</a></p>
        `;
    };
    img.src = MAP_URL + '?t=' + Date.now();
}

function setupCanvas(w, h) {
    const canvas = document.getElementById('map-canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    mapCanvas = canvas;
    mapCtx = canvas.getContext('2d', { willReadFrequently: true });
    mapCtx.drawImage(mapImage, 0, 0);
}

function initMapControls() {
    const viewport = document.getElementById('map-viewport');
    if (!viewport) return;

    viewport.addEventListener('mousedown', (e) => {
        if (!mapReady) return;
        // Игнорируем клики по маркерам игроков
        if (e.target.closest('.map-marker')) return;
        isDragging = true;
        dragMoved = false;
        dragStartX = e.clientX - mapOffsetX;
        dragStartY = e.clientY - mapOffsetY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStartX;
        const newY = e.clientY - dragStartY;
        if (Math.abs(newX - mapOffsetX) > 3 || Math.abs(newY - mapOffsetY) > 3) {
            dragMoved = true;
        }
        mapOffsetX = newX;
        mapOffsetY = newY;
        applyMapTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    viewport.addEventListener('click', (e) => {
        if (!mapReady || dragMoved) return;
        if (e.target.closest('.map-marker')) return; // маркеры обрабатываются сами
        handleMapClick(e);
    });

    viewport.addEventListener('wheel', (e) => {
        if (!mapReady) return;
        e.preventDefault();

        const rect = viewport.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const imgX = (cursorX - mapOffsetX) / mapZoom;
        const imgY = (cursorY - mapOffsetY) / mapZoom;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(12, mapZoom * delta));

        mapZoom = newZoom;
        mapOffsetX = cursorX - imgX * mapZoom;
        mapOffsetY = cursorY - imgY * mapZoom;

        applyMapTransform();
    }, { passive: false });

    const resetBtn = document.getElementById('map-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetMapView);

    const clearBtn = document.getElementById('map-clear-highlight');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        highlightedCountry = null;
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('highlight'));
        document.getElementById('country-details').style.display = 'none';
    });

    const showPlayersCheckbox = document.getElementById('map-show-players');
    if (showPlayersCheckbox) {
        showPlayersCheckbox.addEventListener('change', () => {
            showPlayerMarkers = showPlayersCheckbox.checked;
            renderPlayerMarkers();
        });
    }
}

function handleMapClick(e) {
    const viewport = document.getElementById('map-viewport');
    const rect = viewport.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const imgX = Math.round((cursorX - mapOffsetX) / mapZoom);
    const imgY = Math.round((cursorY - mapOffsetY) / mapZoom);

    if (imgX < 0 || imgY < 0 || imgX >= mapCanvas.width || imgY >= mapCanvas.height) return;

    let pixel;
    try {
        pixel = mapCtx.getImageData(imgX, imgY, 1, 1).data;
    } catch (err) {
        console.warn('Не удалось прочитать пиксель (CORS?):', err);
        return;
    }

    const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
    if (a < 10) return;

    const countries = (currentData?.countries || []);
    let bestIdx = -1;
    let bestDist = 120;
    countries.forEach((c, i) => {
        const hex = PALETTE[i % PALETTE.length];
        const [pr, pg, pb] = hexToRgb(hex);
        const dist = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    });

    if (bestIdx === -1) return;

    const country = countries[bestIdx];
    highlightCountry(country.name);
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.main-nav .nav-btn[data-tab="overview"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-overview').classList.add('active');
    showDetails(country.name);
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16)
    ];
}

function applyMapTransform() {
    const canvas = document.getElementById('map-canvas');
    const overlay = document.getElementById('map-overlay');
    if (!canvas) return;
    const t = `translate(${mapOffsetX}px, ${mapOffsetY}px) scale(${mapZoom})`;
    canvas.style.transform = t;
    if (overlay) overlay.style.transform = t;
}

function resetMapView() {
    const canvas = document.getElementById('map-canvas');
    const viewport = document.getElementById('map-viewport');
    if (!canvas || !viewport || !mapReady) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const iw = mapCanvas.width;
    const ih = mapCanvas.height;
    const scale = Math.min(vw / iw, vh / ih) * 0.98;
    mapZoom = scale;
    mapOffsetX = (vw - iw * scale) / 2;
    mapOffsetY = (vh - ih * scale) / 2;
    applyMapTransform();
}

// ==================== МАРКЕРЫ ИГРОКОВ НА КАРТЕ ====================

/**
 * Конвертирует мировые координаты игрока в пиксели на карте.
 *
 * Расчёт:
 *   chunkX = floor(x / 16)
 *   relChunk = chunkX - min_chunk_x
 *   imgX = relChunk * 32 + (x - chunkX * 16) * 2
 *        = (x - min_chunk_x * 16) * 2
 *
 * Требуется map_meta в JSON:
 *   { "world": "world", "min_chunk_x": -100, "min_chunk_z": -100 }
 */
function worldToImagePx(x, z, mapMeta) {
    const minBX = mapMeta.min_chunk_x * BLOCKS_PER_CHUNK;
    const minBZ = mapMeta.min_chunk_z * BLOCKS_PER_CHUNK;
    return {
        px: (x - minBX) * PIXELS_PER_BLOCK,
        pz: (z - minBZ) * PIXELS_PER_BLOCK
    };
}

function renderPlayerMarkers() {
    const overlay = document.getElementById('map-overlay');
    if (!overlay) return;

    if (!showPlayerMarkers || !mapReady || !currentData) {
        overlay.innerHTML = '';
        return;
    }

    const mapMeta = currentData.map_meta;
    const players = currentData.players || [];

    if (!mapMeta || !mapMeta.min_chunk_x == null || players.length === 0) {
        overlay.innerHTML = '';
        return;
    }

    const markers = [];
    for (const p of players) {
        if (!p.position) continue;
        const pos = p.position;
        if (pos.world && mapMeta.world && pos.world !== mapMeta.world) continue;
        if (pos.x == null || pos.z == null) continue;

        const { px, pz } = worldToImagePx(pos.x, pos.z, mapMeta);
        if (px < 0 || pz < 0 || px > mapCanvas.width || pz > mapCanvas.height) continue;

        const online = !!p.online;
        const name = p.name || '?';
        // Для маленьких голов на карте используем размер 32 (для скинов достаточно)
        const headUrl = `${SKIN_API}/avatar/${encodeURIComponent(name)}/32`;
        const fallback = `${SKIN_API}/avatar/Steve/32`;

        markers.push(`
            <div class="map-marker ${online ? 'online' : ''}"
                 style="left: ${px}px; top: ${pz}px;"
                 onclick="openPlayer('${escapeAttr(name)}'); event.stopPropagation();"
                 title="${escapeAttr(name)} — ${online ? 'онлайн' : 'оффлайн'}">
                <img class="map-marker-head"
                     src="${headUrl}"
                     alt=""
                     loading="lazy"
                     onerror="this.onerror=null;this.src='${fallback}'">
                <div class="map-marker-label">${escapeHtml(name)}</div>
            </div>
        `);
    }

    overlay.innerHTML = markers.join('');
}

// ==================== РЕНДЕР ДАННЫХ ====================

function render() {
    if (!currentData) return;

    document.getElementById('server-name').textContent = currentData.server_name || 'Сервер';
    document.getElementById('online-badge').textContent =
        `Онлайн: ${currentData.online_players || 0} / ${currentData.max_players || 0}`;

    const updated = currentData.updated_at;
    if (updated) {
        const minutes = Math.floor((Date.now() - updated) / 60000);
        const ago = minutes < 1 ? 'только что'
            : minutes < 60 ? `${minutes} мин назад`
            : `${Math.floor(minutes / 60)} ч назад`;
        document.getElementById('updated-badge').textContent = `Обновлено: ${ago}`;
    }

    const countries = currentData.countries || [];
    const players = currentData.players || [];

    document.getElementById('countries-count').textContent = countries.length;
    document.getElementById('total-claims').textContent =
        countries.reduce((sum, c) => sum + (c.claims || 0), 0).toLocaleString('ru-RU');
    document.getElementById('total-bank').textContent =
        formatMoney(countries.reduce((sum, c) => sum + (c.bank || 0), 0));
    document.getElementById('total-energy').textContent =
        countries.reduce((sum, c) => sum + (c.energy || 0), 0).toFixed(1);

    const totalPlayersEl = document.getElementById('total-players');
    if (totalPlayersEl) {
        if (players.length > 0) {
            const online = players.filter(p => p.online).length;
            totalPlayersEl.textContent = online > 0 ? `${online} / ${players.length}` : `${players.length}`;
        } else {
            totalPlayersEl.textContent = `${currentData.online_players || 0}`;
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
            case 'claims':
            default: return (b.claims || 0) - (a.claims || 0);
        }
    });

    const tbody = document.getElementById('countries-body');
    if (!tbody) return;
    if (countries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">На сервере пока нет стран.</td></tr>';
        return;
    }

    tbody.innerHTML = countries.map((c, i) => {
        const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
        return `
            <tr class="${rankClass}" onclick="showDetails('${escapeAttr(c.name)}')">
                <td class="rank">#${i + 1}</td>
                <td class="name">${escapeHtml(c.name || '?')}</td>
                <td>${escapeHtml(c.owner || '?')}</td>
                <td>${c.claims || 0} / ${c.max_claims || '?'}</td>
                <td class="money">${formatMoney(c.bank || 0)}</td>
                <td class="energy">${(c.energy || 0).toFixed(1)}</td>
                <td>${c.allies || 0}</td>
                <td>${c.pacts || 0}</td>
            </tr>
        `;
    }).join('');
}

function renderLegend() {
    if (!currentData) return;
    const countries = currentData.countries || [];
    const legend = document.getElementById('map-legend');
    if (!legend) return;

    if (countries.length === 0) { legend.innerHTML = ''; return; }

    legend.innerHTML = countries.map((c, i) => {
        const color = PALETTE[i % PALETTE.length];
        return `
            <div class="legend-item" data-country="${escapeAttr(c.name)}" onclick="highlightCountry('${escapeAttr(c.name)}')">
                <div class="legend-color" style="background:${color}"></div>
                <span>${escapeHtml(c.name)}</span>
            </div>
        `;
    }).join('');
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
        { label: 'Территория', value: `${country.claims || 0} / ${country.max_claims || '?'} чанков`, cls: '' },
        { label: 'Казна', value: formatMoney(country.bank || 0), cls: 'success' },
        { label: 'Долг', value: formatMoney(country.debt || 0), cls: (country.debt || 0) > 0 ? 'danger' : '' },
        { label: 'Энергия', value: `${(country.energy || 0).toFixed(1)} / ${(country.max_energy || 0).toFixed(1)}`, cls: 'warning' },
        { label: 'Регенерация', value: `${(country.regen || 0).toFixed(1)}/час`, cls: 'warning' },
        { label: 'Уровень ферм', value: country.farm_level || 0, cls: '' },
        { label: 'Союзы', value: country.allies || 0, cls: '' },
        { label: 'Пакты', value: country.pacts || 0, cls: '' },
        { label: '🌾 Ферм', value: country.chunks_farm || 0, cls: '' },
        { label: '⛏ Шахт', value: country.chunks_mining || 0, cls: '' },
        { label: '⚔ Военных', value: country.chunks_military || 0, cls: '' },
        { label: '💰 Торговых', value: country.chunks_trade || 0, cls: '' }
    ];

    content.innerHTML = items.map(it => `
        <div class="detail-item">
            <div class="label">${it.label}</div>
            <div class="value ${it.cls}">${escapeHtml(String(it.value))}</div>
        </div>
    `).join('');

    document.getElementById('country-details').style.display = 'block';
    document.getElementById('country-details').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==================== ИГРОКИ ====================

function initPlayerControls() {
    const search = document.getElementById('player-search');
    if (search) search.addEventListener('input', () => renderPlayers());
    const onlineOnly = document.getElementById('player-online-only');
    if (onlineOnly) onlineOnly.addEventListener('change', () => renderPlayers());
}

function renderPlayers() {
    const grid = document.getElementById('players-grid');
    const empty = document.getElementById('players-empty');
    if (!grid || !empty) return;

    const players = currentData?.players;
    if (!players || players.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    const searchQ = (document.getElementById('player-search')?.value || '').trim().toLowerCase();
    const onlineOnly = document.getElementById('player-online-only')?.checked || false;

    let filtered = [...players];
    if (searchQ) {
        filtered = filtered.filter(p => {
            const n = (p.name || '').toLowerCase();
            const c = (p.country || '').toLowerCase();
            return n.includes(searchQ) || c.includes(searchQ);
        });
    }
    if (onlineOnly) {
        filtered = filtered.filter(p => p.online);
    }

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
    const avatarUrl = `${SKIN_API}/avatar/${encodeURIComponent(name)}/64`;
    const fallbackUrl = `${SKIN_API}/avatar/Steve/64`;
    const online = !!p.online;
    const statusClass = online ? 'online' : 'offline';
    const country = p.country || '';
    const role = p.country_role || '';
    let badge = '';
    if (role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
    else if (role === 'co_ruler' || role === 'co-ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';

    const playtime = formatPlaytime(p.playtime_seconds);
    const money = p.balance != null ? formatMoney(p.balance) : null;

    return `
        <div class="player-card" onclick="openPlayer('${escapeAttr(name)}')">
            ${badge}
            <div class="player-card-avatar">
                <img src="${avatarUrl}" alt="" loading="lazy"
                     onerror="this.onerror=null;this.src='${fallbackUrl}'">
                <div class="status-dot ${statusClass}"></div>
            </div>
            <div class="player-card-info">
                <div class="player-card-name">${escapeHtml(name)}</div>
                <div class="player-card-country">
                    ${country
                        ? `<span class="country-tag">🏛️ ${escapeHtml(country)}</span>`
                        : '<span class="no-country">Без страны</span>'}
                </div>
                <div class="player-card-meta">
                    ${money != null ? `<span class="money">💰 ${money}</span>` : ''}
                    ${playtime ? `<span>⏱ ${playtime}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Открывает модалку игрока с 3D-моделью.
 */
function openPlayer(name) {
    const player = (currentData?.players || []).find(p => p.name === name);
    if (!player) return;

    const online = !!player.online;

    document.getElementById('player-modal-name').textContent = name;
    const statusEl = document.getElementById('player-modal-status');
    statusEl.textContent = online ? '● Онлайн' : '○ Оффлайн';
    statusEl.className = 'player-modal-status ' + (online ? 'online' : 'offline');

    // === Основное ===
    const mainStats = [];
    if (player.uuid) mainStats.push({ label: 'UUID', value: shortenUuid(player.uuid) });
    if (player.balance != null) mainStats.push({ label: 'Баланс', value: formatMoney(player.balance), cls: 'success' });
    if (player.playtime_seconds != null) mainStats.push({ label: 'Время в игре', value: formatPlaytime(player.playtime_seconds) });
    if (player.last_seen) mainStats.push({ label: 'Был в игре', value: timeAgo(player.last_seen) });
    if (player.first_seen) mainStats.push({ label: 'Первый вход', value: timeAgo(player.first_seen) });
    if (player.job) mainStats.push({ label: 'Профессия', value: player.job + (player.job_level ? ' (ур. ' + player.job_level + ')' : '') });
    if (player.kills != null || player.deaths != null) {
        const k = player.kills || 0, d = player.deaths || 0;
        const kd = d > 0 ? (k / d).toFixed(2) : k;
        mainStats.push({ label: 'K / D / K/D', value: `${k} / ${d} / ${kd}` });
    }

    document.getElementById('player-modal-stats-main').innerHTML =
        mainStats.map(s => statRowHtml(s)).join('') ||
        statRowHtml({ label: '—', value: 'Нет данных' });

    // === Страна ===
    const countryStats = [];
    if (player.country) {
        countryStats.push({ label: 'Страна', value: player.country, cls: 'accent' });
        if (player.country_role) {
            const roleName = player.country_role === 'leader' ? 'Лидер'
                : player.country_role === 'co_ruler' ? 'Соправитель'
                : player.country_role;
            countryStats.push({ label: 'Роль', value: roleName });
        }
        const countryData = (currentData.countries || []).find(c => c.name === player.country);
        if (countryData) {
            countryStats.push({ label: 'Казна страны', value: formatMoney(countryData.bank || 0) });
            countryStats.push({ label: 'Территория', value: `${countryData.claims || 0} чанков` });
        }
    } else {
        countryStats.push({ label: 'Страна', value: 'Нет' });
    }
    if (player.bounty != null && player.bounty > 0) {
        countryStats.push({ label: '💀 Награда за голову', value: formatMoney(player.bounty), cls: 'danger' });
    }

    document.getElementById('player-modal-stats-country').innerHTML =
        countryStats.map(s => statRowHtml(s)).join('');

    // === Активность ===
    const activityStats = [];
    if (player.energy != null) activityStats.push({ label: 'Энергия', value: (player.energy).toFixed(1) });
    if (player.max_energy != null) activityStats.push({ label: 'Макс. энергия', value: (player.max_energy).toFixed(1) });
    if (player.achievements_count != null) activityStats.push({ label: 'Достижений', value: player.achievements_count });
    if (player.playtime_seconds != null && player.playtime_seconds > 0) {
        const days = Math.floor(player.playtime_seconds / 86400);
        activityStats.push({ label: 'Дней в игре', value: days });
    }
    if (player.position) {
        const pos = player.position;
        const posStr = `${Math.round(pos.x)}, ${Math.round(pos.y || 0)}, ${Math.round(pos.z)}`;
        activityStats.push({ label: 'Локация', value: posStr });
    }
    if (activityStats.length === 0) {
        activityStats.push({ label: '—', value: 'Нет данных' });
    }
    document.getElementById('player-modal-stats-activity').innerHTML =
        activityStats.map(s => statRowHtml(s)).join('');

    // === Кнопки ===
    const actions = [];
    if (player.country) {
        actions.push(`<button class="player-modal-btn" onclick="gotoCountry('${escapeAttr(player.country)}')">🏛️ Перейти к стране</button>`);
    }
    if (player.position) {
        actions.push(`<button class="player-modal-btn" onclick="gotoPlayerOnMap('${escapeAttr(name)}')">🗺️ Показать на карте</button>`);
    }
    actions.push(`<button class="player-modal-btn" onclick="copyToClipboardSafe('${escapeAttr(name)}')">📋 Скопировать ник</button>`);
    document.getElementById('player-modal-actions').innerHTML = actions.join('');

    // Открываем модалку и инициализируем 3D-модель
    openPlayerModal();
    // Небольшая задержка — нужно, чтобы canvas получил размеры после display:block
    setTimeout(() => initSkinViewer(name), 30);
}

function statRowHtml(s) {
    return `
        <div class="player-stat-row">
            <div class="label">${s.label}</div>
            <div class="value ${s.cls || ''}">${escapeHtml(String(s.value))}</div>
        </div>
    `;
}

// ==================== 3D SKIN VIEWER ====================

/**
 * Загружает и инициализирует 3D-модель игрока через skinview3d.
 *
 * Приоритет скина:
 *   1) data/skins/{name}.png  — локальный PNG (для пираток, залитый вручную)
 *   2) mc-heads.net/skin/{name}  — Mojang
 *   3) mc-heads.net/skin/Steve   — фоллбэк
 */
async function initSkinViewer(name) {
    const canvas = document.getElementById('skin-canvas');
    const loading = document.getElementById('skin-loading');
    if (!canvas) return;

    // Очищаем предыдущий viewer
    if (currentSkinViewer) {
        try { currentSkinViewer.dispose(); } catch (e) {}
        currentSkinViewer = null;
    }

    loading.classList.remove('hidden');
    loading.innerHTML = '<div class="spinner"></div><div>Загрузка скина...</div>';

    if (typeof skinview3d === 'undefined') {
        loading.innerHTML = '<div>⚠ skinview3d не загрузился</div><div style="font-size:11px;">Проверь подключение к интернету</div>';
        return;
    }

    try {
        const viewer = new skinview3d.SkinViewer({
            canvas: canvas,
            width: canvas.clientWidth || 380,
            height: canvas.clientHeight || 380,
            skin: `${SKIN_API}/skin/Steve` // временный скин, сразу перезапишем
        });

        // Настройки камеры и света
        viewer.camera.position.set(20, 25, 40);
        viewer.camera.lookAt(0, 15, 0);
        viewer.controls.enableZoom = true;
        viewer.controls.enablePan = false;
        viewer.controls.minDistance = 20;
        viewer.controls.maxDistance = 100;
        viewer.controls.target.set(0, 15, 0);
        viewer.fov = 50;
        viewer.globalLight.intensity = 0.6;
        viewer.cameraLight.intensity = 1.0;

        // Показываем ник над головой
        viewer.nameTag = new skinview3d.NameTagObject(name);
        viewer.nameTag.visible = true;

        // Анимация вращения (idle-подобная, можно паузить)
        currentRotateAnim = viewer.animations.add(skinview3d.RotatingAnimation);

        // Пробуем загрузить скин по цепочке
        const skinUrl = await resolveSkinUrl(name);
        await viewer.loadSkin(skinUrl);

        // Скрываем лоадер
        loading.classList.add('hidden');

        currentSkinViewer = viewer;

        // Реагируем на ресайз окна
        const ro = new ResizeObserver(() => {
            if (!currentSkinViewer) return;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (w > 0 && h > 0) {
                currentSkinViewer.width = w;
                currentSkinViewer.height = h;
            }
        });
        ro.observe(canvas.parentElement);

    } catch (err) {
        console.error('Ошибка инициализации skinview3d:', err);
        loading.innerHTML = '<div>⚠ Не удалось загрузить модель</div><div style="font-size:11px;">' + escapeHtml(err.message || '') + '</div>';
    }
}

/**
 * Разрешает URL скина: сначала локальный, потом mc-heads, потом Steve.
 */
async function resolveSkinUrl(name) {
    // 1. Локальный файл
    const localUrl = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
    if (await imageExists(localUrl)) {
        return localUrl;
    }
    // 2. Mojang
    const mojangUrl = `${SKIN_API}/skin/${encodeURIComponent(name)}`;
    if (await imageExists(mojangUrl)) {
        return mojangUrl;
    }
    // 3. Steve
    return `${SKIN_API}/skin/Steve`;
}

function imageExists(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url + '?t=' + Date.now();
    });
}

// ==================== НАВИГАЦИЯ ====================

function gotoCountry(name) {
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.main-nav .nav-btn[data-tab="overview"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-overview').classList.add('active');
    highlightCountry(name);
    showDetails(name);
}

/**
 * Закрывает модалку, идёт на карту и центрирует на игроке.
 */
function gotoPlayerOnMap(name) {
    const player = (currentData?.players || []).find(p => p.name === name);
    if (!player || !player.position || !currentData.map_meta) return;

    closePlayerModal();

    // Переключаемся на карту
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.main-nav .nav-btn[data-tab="map"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-map').classList.add('active');

    // Даём вкладке "проявиться", потом центрируем
    setTimeout(() => {
        if (!mapReady) return;
        const { px, pz } = worldToImagePx(player.position.x, player.position.z, currentData.map_meta);
        const viewport = document.getElementById('map-viewport');
        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;

        mapZoom = 1.5;
        mapOffsetX = vw / 2 - px * mapZoom;
        mapOffsetY = vh / 2 - pz * mapZoom;
        applyMapTransform();
    }, 80);
}

function copyToClipboardSafe(text) {
    copyToClipboard(text).then(ok => {
        if (ok) showToast('✓ Скопировано: ' + text);
    });
}

// ==================== BONUS ====================

function renderBonus() {
    if (!currentData) return;

    const jackpot = currentData.jackpot ?? null;
    const jackpotPanel = document.getElementById('panel-jackpot');
    if (jackpot !== null && jackpot > 0) {
        jackpotPanel.style.display = 'block';
        document.getElementById('jackpot-value').textContent = formatMoney(jackpot);
    } else {
        jackpotPanel.style.display = 'none';
    }

    const events = currentData.events || currentData.active_events || [];
    const eventsPanel = document.getElementById('panel-events');
    if (events.length > 0) {
        eventsPanel.style.display = 'block';
        document.getElementById('events-list').innerHTML = events.map(e => `
            <div class="event-item ${e.type === 'negative' ? 'negative' : 'positive'}">
                <div>
                    <div class="name">${escapeHtml(e.name || e.id || '?')}</div>
                    <div class="desc">${escapeHtml(e.description || '')}</div>
                </div>
            </div>
        `).join('');
    } else {
        eventsPanel.style.display = 'none';
    }

    const wars = currentData.wars || [];
    const warsPanel = document.getElementById('panel-wars');
    if (wars.length > 0) {
        warsPanel.style.display = 'block';
        document.getElementById('wars-list').innerHTML = wars.map(w => `
            <div class="war-item">
                <div>
                    <div class="name">${escapeHtml(w.attacker)} ⚔ ${escapeHtml(w.defender)}</div>
                    <div class="desc">С ${formatDate(w.started_at)}</div>
                </div>
            </div>
        `).join('');
    } else {
        warsPanel.style.display = 'none';
    }

    const topPoker = currentData.top_poker || [];
    const pokerPanel = document.getElementById('panel-poker');
    if (topPoker.length > 0) {
        pokerPanel.style.display = 'block';
        document.getElementById('poker-body').innerHTML = topPoker.map((p, i) => {
            const cls = p.profit >= 0 ? 'money' : '';
            const sign = p.profit >= 0 ? '+' : '';
            return `<tr>
                <td class="rank">#${i + 1}</td>
                <td class="name">${escapeHtml(p.name || '?')}</td>
                <td class="${cls}">${sign}${formatMoney(p.profit || 0)}</td>
                <td>${p.hands || 0}</td>
            </tr>`;
        }).join('');
    } else {
        pokerPanel.style.display = 'none';
    }

    const bounties = currentData.bounties || [];
    const bountiesPanel = document.getElementById('panel-bounties');
    if (bounties.length > 0) {
        bountiesPanel.style.display = 'block';
        document.getElementById('bounties-list').innerHTML = bounties.map(b => `
            <div class="bounty-item">
                <div>
                    <div class="name">${escapeHtml(b.target || '?')}</div>
                    <div class="desc">Награда: ${formatMoney(b.amount || 0)}</div>
                </div>
            </div>
        `).join('');
    } else {
        bountiesPanel.style.display = 'none';
    }

    const anyBonus = (jackpot > 0) || events.length > 0 || wars.length > 0
        || topPoker.length > 0 || bounties.length > 0;
    document.getElementById('panel-bonus-empty').style.display = anyBonus ? 'none' : 'block';
}

// ==================== КОПИРОВАНИЕ ====================

function initCommandCopy() {
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('code[data-copy]');
        if (!target) return;
        e.preventDefault();
        const text = target.getAttribute('data-copy');
        if (!text) return;

        copyToClipboard(text).then(ok => {
            if (ok) showToast('✓ Скопировано: ' + text);
        });
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
            .then(() => true)
            .catch(() => fallbackCopy(text));
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
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
}

let toastTimer = null;
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

// ==================== GUIDE NAV ====================

function initGuideNav() {
    const nav = document.getElementById('guide-nav');
    if (!nav) return;

    const sections = document.querySelectorAll('.guide-section h2[data-guide-title]');
    sections.forEach(h2 => {
        const section = h2.closest('.guide-section');
        if (!section) return;
        const id = section.id;
        const title = h2.textContent.trim();

        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = title;
        a.dataset.target = id;
        nav.appendChild(a);
    });

    const navLinks = nav.querySelectorAll('a');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(a => a.classList.toggle('active', a.dataset.target === entry.target.id));
            }
        });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    sections.forEach(h2 => {
        const section = h2.closest('.guide-section');
        if (section) observer.observe(section);
    });

    navLinks.forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const el = document.getElementById(a.dataset.target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ==================== COMMANDS LIST ====================

const COMMANDS = [
    { cmd: '/c', desc: 'Главное меню страны', plugin: 'Sovereignty' },
    { cmd: '/c create МояСтрана', desc: 'Создать страну', plugin: 'Sovereignty' },
    { cmd: '/c rename НовоеИмя', desc: 'Переименовать', plugin: 'Sovereignty' },
    { cmd: '/c info', desc: 'Информация о стране', plugin: 'Sovereignty' },
    { cmd: '/c list', desc: 'Список стран', plugin: 'Sovereignty' },
    { cmd: '/c top', desc: 'Топ стран', plugin: 'Sovereignty' },
    { cmd: '/c claim', desc: 'Захватить чанк', plugin: 'Sovereignty' },
    { cmd: '/c unclaim', desc: 'Освободить чанк', plugin: 'Sovereignty' },
    { cmd: '/c autoclaim', desc: 'Автозахват', plugin: 'Sovereignty' },
    { cmd: '/c seechunk', desc: 'Границы территории', plugin: 'Sovereignty' },
    { cmd: '/c unstuck', desc: 'Телепорт с чужой территории', plugin: 'Sovereignty' },
    { cmd: '/c map', desc: 'Текстовая карта', plugin: 'Sovereignty' },
    { cmd: '/c invite Steve', desc: 'Пригласить соправителя', plugin: 'Sovereignty' },
    { cmd: '/c kick Steve', desc: 'Исключить соправителя', plugin: 'Sovereignty' },
    { cmd: '/c accept', desc: 'Принять приглашение', plugin: 'Sovereignty' },
    { cmd: '/c decline', desc: 'Отклонить приглашение', plugin: 'Sovereignty' },
    { cmd: '/c bank', desc: 'Баланс казны', plugin: 'Sovereignty' },
    { cmd: '/c bank deposit 5000', desc: 'Внести в казну', plugin: 'Sovereignty' },
    { cmd: '/c bank withdraw 5000', desc: 'Снять из казны', plugin: 'Sovereignty' },
    { cmd: '/c upgrade', desc: 'Меню прокачки', plugin: 'Sovereignty' },
    { cmd: '/c buyenergy 10', desc: 'Купить энергию', plugin: 'Sovereignty' },
    { cmd: '/c boost', desc: 'Буст регенерации', plugin: 'Sovereignty' },
    { cmd: '/c research', desc: 'Дерево технологий', plugin: 'Sovereignty' },
    { cmd: '/c achievements', desc: 'Достижения', plugin: 'Sovereignty' },
    { cmd: '/c court', desc: 'Международный суд', plugin: 'Sovereignty' },
    { cmd: '/c ally Steve', desc: 'Союз', plugin: 'Sovereignty' },
    { cmd: '/c enemy Steve', desc: 'Война', plugin: 'Sovereignty' },
    { cmd: '/c neutral Steve', desc: 'Нейтралитет', plugin: 'Sovereignty' },
    { cmd: '/c pact trade Steve', desc: 'Пакт', plugin: 'Sovereignty' },
    { cmd: '/c surrender', desc: 'Капитуляция', plugin: 'Sovereignty' },
    { cmd: '/tax', desc: 'Налоги', plugin: 'TaxCollector' },
    { cmd: '/tax pay', desc: 'Оплатить долг', plugin: 'TaxCollector' },
    { cmd: '/shop', desc: 'Рынок', plugin: 'MarketGUI' },
    { cmd: '/shop add diamond 10', desc: 'Продать за ресурсы', plugin: 'MarketGUI' },
    { cmd: '/shop add money 500', desc: 'Продать за валюту', plugin: 'MarketGUI' },
    { cmd: '/shop sell', desc: 'Свои товары', plugin: 'MarketGUI' },
    { cmd: '/auc', desc: 'Аукцион', plugin: 'AuctionHouse' },
    { cmd: '/auc add 100 60', desc: 'Выставить предмет', plugin: 'AuctionHouse' },
    { cmd: '/auc bid 1 200', desc: 'Сделать ставку', plugin: 'AuctionHouse' },
    { cmd: '/bounty Steve 5000', desc: 'Награда за голову', plugin: 'Bounty' },
    { cmd: '/bounty list', desc: 'Топ целей', plugin: 'Bounty' },
    { cmd: '/bounty menu', desc: 'GUI наёмников', plugin: 'Bounty' },
    { cmd: '/roll', desc: 'Хаб казино', plugin: 'RollGame' },
    { cmd: '/roll slots 1000', desc: 'Слоты', plugin: 'RollGame' },
    { cmd: '/roll duel 1000', desc: 'Дуэль', plugin: 'RollGame' },
    { cmd: '/roll mines 1000 3 5', desc: 'Мины', plugin: 'RollGame' },
    { cmd: '/roll wheel 1000', desc: 'Колесо', plugin: 'RollGame' },
    { cmd: '/roll stairs 1000', desc: 'Лестница', plugin: 'RollGame' },
    { cmd: '/roll poker', desc: 'Покер', plugin: 'RollGame' },
    { cmd: '/roll poker tables', desc: 'Список столов', plugin: 'RollGame' },
    { cmd: '/roll poker create 5000', desc: 'Создать стол', plugin: 'RollGame' },
    { cmd: '/roll poker join 1', desc: 'Присоединиться', plugin: 'RollGame' },
    { cmd: '/roll poker top', desc: 'Топ покера', plugin: 'RollGame' },
    { cmd: '/roll bet 1000', desc: 'Ставка в рулетке', plugin: 'RollGame' },
    { cmd: '/roll jackpot', desc: 'Джекпот', plugin: 'RollGame' },
    { cmd: '/roll stats', desc: 'Личная статистика', plugin: 'RollGame' },
    { cmd: '/roll top', desc: 'Топ игроков', plugin: 'RollGame' },
    { cmd: '/bal', desc: 'Баланс', plugin: 'EssentialsX' },
    { cmd: '/pay Steve 1000', desc: 'Перевод', plugin: 'EssentialsX' },
    { cmd: '/baltop', desc: 'Топ богачей', plugin: 'EssentialsX' },
    { cmd: '/sell hand', desc: 'Продать из руки', plugin: 'EssentialsX' },
    { cmd: '/sell all', desc: 'Продать всё', plugin: 'EssentialsX' },
    { cmd: '/worth', desc: 'Цена предмета', plugin: 'EssentialsX' },
    { cmd: '/sethome', desc: 'Поставить дом', plugin: 'EssentialsX' },
    { cmd: '/home', desc: 'Телепорт домой', plugin: 'EssentialsX' },
    { cmd: '/spawn', desc: 'На спавн', plugin: 'EssentialsX' },
    { cmd: '/tpa Steve', desc: 'Запрос ТП', plugin: 'EssentialsX' },
    { cmd: '/jobs browse', desc: 'Список профессий', plugin: 'Jobs' },
    { cmd: '/jobs stats', desc: 'Статистика', plugin: 'Jobs' },
    { cmd: '/jobs leave', desc: 'Уволиться', plugin: 'Jobs' },
    { cmd: '/skin Steve', desc: 'Скин по нику', plugin: 'SkinsRestorer' },
    { cmd: '/skins', desc: 'Меню скинов', plugin: 'SkinsRestorer' },
    { cmd: '/skin set 12345', desc: 'Свой скин (Mineskin)', plugin: 'SkinsRestorer' },
];

function initCommandSearch() {
    const list = document.getElementById('commands-list');
    if (!list) return;

    list.innerHTML = COMMANDS.map(c => `
        <div class="command-item">
            <div class="cmd-name"><code data-copy="${escapeAttr(c.cmd)}">${escapeHtml(c.cmd)}</code></div>
            <div class="cmd-desc">${escapeHtml(c.desc)}</div>
            <div class="cmd-plugin">${escapeHtml(c.plugin)}</div>
        </div>
    `).join('');

    const searchInput = document.getElementById('cmd-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        document.querySelectorAll('.command-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.classList.toggle('hidden', q.length > 0 && !text.includes(q));
        });
    });
}

// ==================== УТИЛИТЫ ====================

function formatMoney(amount) {
    if (amount == null) return '0';
    if (Math.abs(amount) >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(amount) >= 1_000) return (amount / 1_000).toFixed(1) + 'k';
    return Math.round(amount).toString();
}

function formatPlaytime(seconds) {
    if (seconds == null || seconds <= 0) return '';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (d > 0) return h > 0 ? `${d}д ${h}ч` : `${d}д`;
    if (h > 0) return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
    if (m > 0) return `${m}м`;
    return `${s}с`;
}

function timeAgo(timestampMs) {
    if (!timestampMs) return '—';
    const diff = Date.now() - timestampMs;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'только что';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} мин назад`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} ч назад`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} дн назад`;
    const mo = Math.floor(d / 30);
    return `${mo} мес назад`;
}

function formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function shortenUuid(uuid) {
    if (!uuid) return '—';
    return uuid.length > 13 ? uuid.substring(0, 8) + '…' : uuid;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
