/**
 * Панель Sovereignty — полный скрипт.
 * Табы, карта, игроки, 3D-профиль, копирование команд, бонусы.
 */

const DATA_URL = 'data/server1.json';
const MAP_URL = 'data/map.png';
const LOCAL_SKIN_DIR = 'data/skins/';
const SKIN_API = 'https://mc-heads.net';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const BLOCKS_PER_CHUNK = 16;
const PIXELS_PER_BLOCK = 2;

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
        currentSkinViewer.camera.position.set(20, 25, 40);
        currentSkinViewer.camera.lookAt(0, 15, 0);
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
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const nZ = Math.max(0.1, Math.min(12, mapZoom * delta));
        mapZoom = nZ;
        mapOffsetX = cX - iX * mapZoom;
        mapOffsetY = cY - iY * mapZoom;
        applyMapTransform();
    }, { passive: false });

    const r = document.getElementById('map-reset');
    if (r) r.addEventListener('click', resetMapView);

    const c = document.getElementById('map-clear-highlight');
    if (c) c.addEventListener('click', () => {
        highlightedCountry = null;
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('highlight'));
        document.getElementById('country-details').style.display = 'none';
    });

    const sp = document.getElementById('map-show-players');
    if (sp) sp.addEventListener('change', () => {
        showPlayerMarkers = sp.checked;
        renderPlayerMarkers();
    });
}

function handleMapClick(e) {
    const viewport = document.getElementById('map-viewport');
    const rect = viewport.getBoundingClientRect();
    const cX = e.clientX - rect.left, cY = e.clientY - rect.top;
    const iX = Math.round((cX - mapOffsetX) / mapZoom);
    const iY = Math.round((cY - mapOffsetY) / mapZoom);
    if (iX < 0 || iY < 0 || iX >= mapCanvas.width || iY >= mapCanvas.height) return;

    let px;
    try { px = mapCtx.getImageData(iX, iY, 1, 1).data; }
    catch (err) { console.warn('CORS?', err); return; }

    const r = px[0], g = px[1], b = px[2], a = px[3];
    if (a < 10) return;

    const countries = currentData?.countries || [];
    let bestIdx = -1, bestDist = 120;
    countries.forEach((c, i) => {
        const [pr, pg, pb] = hexToRgb(PALETTE[i % PALETTE.length]);
        const d = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
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
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
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
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const iw = mapCanvas.width, ih = mapCanvas.height;
    const scale = Math.min(vw / iw, vh / ih) * 0.98;
    mapZoom = scale;
    mapOffsetX = (vw - iw * scale) / 2;
    mapOffsetY = (vh - ih * scale) / 2;
    applyMapTransform();
}

// ==================== PLAYER MARKERS ====================

function worldToImagePx(x, z, mapMeta) {
    const minBX = mapMeta.min_chunk_x * BLOCKS_PER_CHUNK;
    const minBZ = mapMeta.min_chunk_z * BLOCKS_PER_CHUNK;
    return { px: (x - minBX) * PIXELS_PER_BLOCK, pz: (z - minBZ) * PIXELS_PER_BLOCK };
}

function renderPlayerMarkers() {
    const overlay = document.getElementById('map-overlay');
    if (!overlay) return;
    if (!showPlayerMarkers || !mapReady || !currentData) { overlay.innerHTML = ''; return; }

    const mapMeta = currentData.map_meta;
    const players = currentData.players || [];
    if (!mapMeta || players.length === 0) { overlay.innerHTML = ''; return; }

    const markers = [];
    for (const p of players) {
        const pos = p.position;
        if (!pos || pos.x == null || pos.z == null) continue;
        if (pos.world && mapMeta.world && pos.world !== mapMeta.world) continue;

        const { px, pz } = worldToImagePx(pos.x, pos.z, mapMeta);
        if (px < 0 || pz < 0 || px > mapCanvas.width || pz > mapCanvas.height) continue;

        const online = !!p.online;
        const name = p.name || '?';
        const headUrl = `${SKIN_API}/avatar/${encodeURIComponent(name)}/32`;
        const fallback = `${SKIN_API}/avatar/Steve/32`;

        markers.push(`<div class="map-marker ${online ? 'online' : ''}"
             style="left:${px}px; top:${pz}px;"
             onclick="openPlayer('${escapeAttr(name)}'); event.stopPropagation();"
             title="${escapeAttr(name)}">
            <img class="map-marker-head" src="${headUrl}" alt="" loading="lazy"
                 onerror="this.onerror=null;this.src='${fallback}'">
            <div class="map-marker-label">${escapeHtml(name)}</div>
        </div>`);
    }
    overlay.innerHTML = markers.join('');
}

// ==================== PLAYERS ====================

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

    const players = currentData?.players;
    if (!players || players.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    const q = (document.getElementById('player-search')?.value || '').trim().toLowerCase();
    const onlineOnly = document.getElementById('player-online-only')?.checked || false;

    let filtered = [...players];
    if (q) filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(q) || (p.country || '').toLowerCase().includes(q));
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
    const avatar = `${SKIN_API}/avatar/${encodeURIComponent(name)}/64`;
    const fallback = `${SKIN_API}/avatar/Steve/64`;
    const online = !!p.online;
    let badge = '';
    if (p.country_role === 'leader') badge = '<div class="player-card-badge leader">Лидер</div>';
    else if (p.country_role === 'co_ruler') badge = '<div class="player-card-badge co-ruler">Co</div>';

    const playtime = formatPlaytime(p.playtime_seconds);
    const money = p.balance != null ? formatMoney(p.balance) : null;

    return `<div class="player-card" onclick="openPlayer('${escapeAttr(name)}')">
        ${badge}
        <div class="player-card-avatar">
            <img src="${avatar}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">
            <div class="status-dot ${online ? 'online' : 'offline'}"></div>
        </div>
        <div class="player-card-info">
            <div class="player-card-name">${escapeHtml(name)}</div>
            <div class="player-card-country">
                ${p.country ? `<span class="country-tag">🏛️ ${escapeHtml(p.country)}</span>`
                            : '<span class="no-country">Без страны</span>'}
            </div>
            <div class="player-card-meta">
                ${money != null ? `<span class="money">💰 ${money}</span>` : ''}
                ${playtime ? `<span>⏱ ${playtime}</span>` : ''}
            </div>
        </div>
    </div>`;
}

// ==================== PLAYER MODAL ====================

function openPlayer(name) {
    const player = (currentData?.players || []).find(p => p.name === name);
    if (!player) return;

    const online = !!player.online;
    document.getElementById('player-modal-name').textContent = name;
    const st = document.getElementById('player-modal-status');
    st.textContent = online ? '● Онлайн' : '○ Оффлайн';
    st.className = 'player-modal-status ' + (online ? 'online' : 'offline');

    // Основное
    const main = [];
    if (player.uuid) main.push({ label: 'UUID', value: shortenUuid(player.uuid) });
    if (player.balance != null) main.push({ label: 'Баланс', value: formatMoney(player.balance), cls: 'success' });
    if (player.playtime_seconds != null) main.push({ label: 'Время в игре', value: formatPlaytime(player.playtime_seconds) });
    if (player.last_seen) main.push({ label: 'Был в игре', value: timeAgo(player.last_seen) });
    if (player.first_seen) main.push({ label: 'Первый вход', value: timeAgo(player.first_seen) });
    if (player.job) main.push({ label: 'Профессия', value: player.job + (player.job_level ? ' (ур. ' + player.job_level + ')' : '') });
    if (player.kills != null || player.deaths != null) {
        const k = player.kills || 0, d = player.deaths || 0;
        const kd = d > 0 ? (k / d).toFixed(2) : k;
        main.push({ label: 'K / D / K/D', value: `${k} / ${d} / ${kd}` });
    }
    document.getElementById('player-modal-stats-main').innerHTML =
        main.map(s => statRow(s)).join('') || statRow({ label: '—', value: 'Нет данных' });

    // Страна
    const cStats = [];
    if (player.country) {
        cStats.push({ label: 'Страна', value: player.country, cls: 'accent' });
        if (player.country_role) {
            const rn = player.country_role === 'leader' ? 'Лидер'
                : player.country_role === 'co_ruler' ? 'Соправитель' : player.country_role;
            cStats.push({ label: 'Роль', value: rn });
        }
        const cd = (currentData.countries || []).find(c => c.name === player.country);
        if (cd) {
            cStats.push({ label: 'Казна страны', value: formatMoney(cd.bank || 0) });
            cStats.push({ label: 'Территория', value: `${cd.claims || 0} чанков` });
        }
    } else {
        cStats.push({ label: 'Страна', value: 'Нет' });
    }
    if (player.bounty != null && player.bounty > 0) {
        cStats.push({ label: '💀 Награда', value: formatMoney(player.bounty), cls: 'danger' });
    }
    document.getElementById('player-modal-stats-country').innerHTML = cStats.map(s => statRow(s)).join('');

    // Активность
    const act = [];
    if (player.energy != null) act.push({ label: 'Энергия', value: player.energy.toFixed(1) });
    if (player.max_energy != null) act.push({ label: 'Макс. энергия', value: player.max_energy.toFixed(1) });
    if (player.achievements_count != null) act.push({ label: 'Достижений', value: player.achievements_count });
    if (player.playtime_seconds > 0) act.push({ label: 'Дней в игре', value: Math.floor(player.playtime_seconds / 86400) });
    if (player.position) {
        const pos = player.position;
        act.push({ label: 'Локация', value: `${Math.round(pos.x)}, ${Math.round(pos.y || 0)}, ${Math.round(pos.z)}` });
    }
    if (act.length === 0) act.push({ label: '—', value: 'Нет данных' });
    document.getElementById('player-modal-stats-activity').innerHTML = act.map(s => statRow(s)).join('');

    // Кнопки
    const actions = [];
    if (player.country) {
        actions.push(`<button class="player-modal-btn" onclick="gotoCountry('${escapeAttr(player.country)}')">🏛️ Перейти к стране</button>`);
    }
    if (player.position) {
        actions.push(`<button class="player-modal-btn" onclick="gotoPlayerOnMap('${escapeAttr(name)}')">🗺️ На карте</button>`);
    }
    actions.push(`<button class="player-modal-btn" onclick="copyToClipboardSafe('${escapeAttr(name)}')">📋 Ник</button>`);
    document.getElementById('player-modal-actions').innerHTML = actions.join('');

    openPlayerModal();
    setTimeout(() => initSkinViewer(name), 40);
}

function statRow(s) {
    return `<div class="player-stat-row">
        <div class="label">${s.label}</div>
        <div class="value ${s.cls || ''}">${escapeHtml(String(s.value))}</div>
    </div>`;
}

// ==================== 3D SKIN ====================

async function initSkinViewer(name) {
    const canvas = document.getElementById('skin-canvas');
    const loading = document.getElementById('skin-loading');
    if (!canvas) return;

    if (currentSkinViewer) {
        try { currentSkinViewer.dispose(); } catch (e) {}
        currentSkinViewer = null;
    }

    loading.classList.remove('hidden');
    loading.innerHTML = '<div class="spinner"></div><div>Загрузка скина...</div>';

    // Ждём загрузки skinview3d (до 4 секунд)
    let waited = 0;
    while (window.__skinview3dStatus === 'loading' && waited < 4000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
    }

    if (typeof skinview3d === 'undefined') {
        loading.innerHTML = '<div style="text-align:center;padding:20px;">' +
            '<div style="font-size:32px;margin-bottom:8px;">⚠</div>' +
            '<div style="color:#f59e0b;font-weight:600;">skinview3d не загрузился</div>' +
            '<div style="font-size:11px;color:#8b91a6;margin-top:6px;max-width:240px;">' +
            'Проверь интернет / блокировщик рекламы. Библиотека грузится с CDN.</div>' +
            '</div>';
        return;
    }

    try {
        const viewer = new skinview3d.SkinViewer({
            canvas: canvas,
            width: canvas.clientWidth || 380,
            height: canvas.clientHeight || 380,
            skin: `${SKIN_API}/skin/Steve`
        });

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

        try {
            viewer.nameTag = new skinview3d.NameTagObject(name);
            viewer.nameTag.visible = true;
        } catch (e) {}

        try {
            currentRotateAnim = viewer.animations.add(skinview3d.RotatingAnimation);
        } catch (e) {}

        const skinUrl = await resolveSkinUrl(name);
        await viewer.loadSkin(skinUrl);

        loading.classList.add('hidden');
        currentSkinViewer = viewer;

        const ro = new ResizeObserver(() => {
            if (!currentSkinViewer) return;
            const w = canvas.clientWidth, h = canvas.clientHeight;
            if (w > 0 && h > 0) {
                currentSkinViewer.width = w;
                currentSkinViewer.height = h;
            }
        });
        ro.observe(canvas.parentElement);
    } catch (err) {
        console.error('[skinview3d] Ошибка:', err);
        loading.innerHTML = '<div style="text-align:center;padding:20px;">' +
            '<div style="font-size:32px;margin-bottom:8px;">⚠</div>' +
            '<div style="color:#ef4444;font-weight:600;">Не удалось построить модель</div>' +
            '<div style="font-size:11px;color:#8b91a6;margin-top:6px;">' +
            escapeHtml(err.message || '') + '</div></div>';
    }
}

async function resolveSkinUrl(name) {
    const local = LOCAL_SKIN_DIR + encodeURIComponent(name) + '.png';
    if (await imageExists(local)) return local;
    const mojang = `${SKIN_API}/skin/${encodeURIComponent(name)}`;
    if (await imageExists(mojang)) return mojang;
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

// ==================== NAV ====================

function gotoCountry(name) {
    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.main-nav .nav-btn[data-tab="overview"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-overview').classList.add('active');
    highlightCountry(name);
    showDetails(name);
}

function gotoPlayerOnMap(name) {
    const player = (currentData?.players || []).find(p => p.name === name);
    if (!player || !player.position || !currentData.map_meta) return;

    closePlayerModal();
    document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.main-nav .nav-btn[data-tab="map"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-map').classList.add('active');

    setTimeout(() => {
        if (!mapReady) return;
        const { px, pz } = worldToImagePx(player.position.x, player.position.z, currentData.map_meta);
        const viewport = document.getElementById('map-viewport');
        const vw = viewport.clientWidth, vh = viewport.clientHeight;
        mapZoom = 1.5;
        mapOffsetX = vw / 2 - px * mapZoom;
        mapOffsetY = vh / 2 - pz * mapZoom;
        applyMapTransform();
    }, 80);
}

function copyToClipboardSafe(text) {
    copyToClipboard(text).then(ok => { if (ok) showToast('✓ Скопировано: ' + text); });
}

// ==================== BONUS ====================

function renderBonus() {
    if (!currentData) return;

    const jackpot = currentData.jackpot ?? null;
    const jp = document.getElementById('panel-jackpot');
    if (jackpot !== null && jackpot > 0) {
        jp.style.display = 'block';
        document.getElementById('jackpot-value').textContent = formatMoney(jackpot);
    } else { jp.style.display = 'none'; }

    const events = currentData.events || [];
    const ep = document.getElementById('panel-events');
    if (events.length > 0) {
        ep.style.display = 'block';
        document.getElementById('events-list').innerHTML = events.map(e => `
            <div class="event-item ${e.type === 'negative' ? 'negative' : 'positive'}">
                <div><div class="name">${escapeHtml(e.name || e.id || '?')}</div>
                <div class="desc">${escapeHtml(e.description || '')}</div></div>
            </div>`).join('');
    } else { ep.style.display = 'none'; }

    const wars = currentData.wars || [];
    const wp = document.getElementById('panel-wars');
    if (wars.length > 0) {
        wp.style.display = 'block';
        document.getElementById('wars-list').innerHTML = wars.map(w => `
            <div class="war-item"><div>
                <div class="name">${escapeHtml(w.attacker)} ⚔ ${escapeHtml(w.defender)}</div>
                <div class="desc">С ${formatDate(w.started_at)}</div>
            </div></div>`).join('');
    } else { wp.style.display = 'none'; }

    const poker = currentData.top_poker || [];
    const pp = document.getElementById('panel-poker');
    if (poker.length > 0) {
        pp.style.display = 'block';
        document.getElementById('poker-body').innerHTML = poker.map((p, i) => {
            const sgn = p.profit >= 0 ? '+' : '';
            return `<tr><td class="rank">#${i + 1}</td>
                <td class="name">${escapeHtml(p.name || '?')}</td>
                <td class="${p.profit >= 0 ? 'money' : ''}">${sgn}${formatMoney(p.profit || 0)}</td>
                <td>${p.hands || 0}</td></tr>`;
        }).join('');
    } else { pp.style.display = 'none'; }

    const bounties = currentData.bounties || [];
    const bp = document.getElementById('panel-bounties');
    if (bounties.length > 0) {
        bp.style.display = 'block';
        document.getElementById('bounties-list').innerHTML = bounties.map(b => `
            <div class="bounty-item"><div>
                <div class="name">${escapeHtml(b.target || '?')}</div>
                <div class="desc">Награда: ${formatMoney(b.amount || 0)}</div>
            </div></div>`).join('');
    } else { bp.style.display = 'none'; }

    const auctions = currentData.active_auctions || [];
    const ap = document.getElementById('panel-auctions');
    if (auctions.length > 0) {
        ap.style.display = 'block';
        document.getElementById('auctions-list').innerHTML = auctions.map(a => `
            <div class="bounty-item"><div>
                <div class="name">#${a.id} ${escapeHtml(a.item || '?')}</div>
                <div class="desc">Продавец: ${escapeHtml(a.seller || '?')} • Цена: ${formatMoney(a.current_price || 0)}</div>
            </div></div>`).join('');
    } else { ap.style.display = 'none'; }

    const tax = currentData.tax_debts || [];
    const tp = document.getElementById('panel-tax');
    if (tax.length > 0) {
        tp.style.display = 'block';
        document.getElementById('tax-list').innerHTML = tax.map(t => `
            <div class="bounty-item"><div>
                <div class="name">${escapeHtml(t.player || '?')}${t.country ? ' (' + escapeHtml(t.country) + ')' : ''}</div>
                <div class="desc">Долг: ${formatMoney(t.debt || 0)} • Просрочек: ${t.missed || 0}</div>
            </div></div>`).join('');
    } else { tp.style.display = 'none'; }

    const market = currentData.market_categories || null;
    const mp = document.getElementById('panel-market');
    if (market && ((market.top_items && market.top_items.length > 0) || (market.categories && market.categories.length > 0))) {
        mp.style.display = 'block';
        const top = market.top_items || [];
        const cats = market.categories || [];
        let html = '';
        if (cats.length > 0) {
            html += '<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px;">';
            html += cats.map(c => `<span class="badge">${escapeHtml(c.name)}: ${c.count}</span>`).join('');
            html += '</div>';
        }
        html += top.map(t => `<div class="bounty-item"><div>
            <div class="name">${escapeHtml(t.item || '?')}</div>
            <div class="desc">Продавец: ${escapeHtml(t.seller || '?')} • ${formatMoney(t.price || 0)}</div>
        </div></div>`).join('');
        document.getElementById('market-list').innerHTML = html;
    } else { mp.style.display = 'none'; }

    const anyBonus = (jackpot > 0) || events.length > 0 || wars.length > 0
        || poker.length > 0 || bounties.length > 0 || auctions.length > 0
        || tax.length > 0 || (market && market.top_items);
    document.getElementById('panel-bonus-empty').style.display = anyBonus ? 'none' : 'block';
}

// ==================== COPY ====================

function initCommandCopy() {
    document.body.addEventListener('click', (e) => {
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
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
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

// ==================== GUIDE NAV ====================

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

// ==================== COMMANDS ====================

const COMMANDS = [
    { cmd: '/c', desc: 'Главное меню страны', plugin: 'Sovereignty' },
    { cmd: '/c create МояСтрана', desc: 'Создать страну', plugin: 'Sovereignty' },
    { cmd: '/c rename НовоеИмя', desc: 'Переименовать', plugin: 'Sovereignty' },
    { cmd: '/c info', desc: 'Информация', plugin: 'Sovereignty' },
    { cmd: '/c list', desc: 'Список стран', plugin: 'Sovereignty' },
    { cmd: '/c top', desc: 'Топ стран', plugin: 'Sovereignty' },
    { cmd: '/c claim', desc: 'Захватить чанк', plugin: 'Sovereignty' },
    { cmd: '/c unclaim', desc: 'Освободить чанк', plugin: 'Sovereignty' },
    { cmd: '/c autoclaim', desc: 'Автозахват', plugin: 'Sovereignty' },
    { cmd: '/c seechunk', desc: 'Границы', plugin: 'Sovereignty' },
    { cmd: '/c unstuck', desc: 'Телепорт', plugin: 'Sovereignty' },
    { cmd: '/c map', desc: 'Карта', plugin: 'Sovereignty' },
    { cmd: '/c chunkupgrade', desc: 'Типы чанка', plugin: 'Sovereignty' },
    { cmd: '/c invite Steve', desc: 'Пригласить соправителя', plugin: 'Sovereignty' },
    { cmd: '/c kick Steve', desc: 'Исключить', plugin: 'Sovereignty' },
    { cmd: '/c accept', desc: 'Принять', plugin: 'Sovereignty' },
    { cmd: '/c decline', desc: 'Отклонить', plugin: 'Sovereignty' },
    { cmd: '/c bank', desc: 'Баланс казны', plugin: 'Sovereignty' },
    { cmd: '/c bank deposit 5000', desc: 'Внести в казну', plugin: 'Sovereignty' },
    { cmd: '/c bank withdraw 5000', desc: 'Снять из казны', plugin: 'Sovereignty' },
    { cmd: '/c bank withdraw all', desc: 'Снять всё', plugin: 'Sovereignty' },
    { cmd: '/c upgrade', desc: 'Прокачка', plugin: 'Sovereignty' },
    { cmd: '/c buyenergy 10', desc: 'Купить энергию', plugin: 'Sovereignty' },
    { cmd: '/c boost', desc: 'Буст регенерации', plugin: 'Sovereignty' },
    { cmd: '/c research', desc: 'Исследования', plugin: 'Sovereignty' },
    { cmd: '/c achievements', desc: 'Достижения', plugin: 'Sovereignty' },
    { cmd: '/c court', desc: 'Суд', plugin: 'Sovereignty' },
    { cmd: '/c court file Steve Причина', desc: 'Жалоба', plugin: 'Sovereignty' },
    { cmd: '/c ally Steve', desc: 'Союз', plugin: 'Sovereignty' },
    { cmd: '/c enemy Steve', desc: 'Война', plugin: 'Sovereignty' },
    { cmd: '/c neutral Steve', desc: 'Нейтралитет', plugin: 'Sovereignty' },
    { cmd: '/c pact trade Steve', desc: 'Пакт', plugin: 'Sovereignty' },
    { cmd: '/c surrender', desc: 'Капитуляция', plugin: 'Sovereignty' },
    { cmd: '/c miningboost', desc: 'Шахтёрский бонус', plugin: 'Sovereignty' },
    { cmd: '/tax', desc: 'Налоги', plugin: 'TaxCollector' },
    { cmd: '/tax pay', desc: 'Оплатить долг', plugin: 'TaxCollector' },
    { cmd: '/shop', desc: 'Рынок', plugin: 'MarketGUI' },
    { cmd: '/shop add diamond 10', desc: 'Продать за ресурсы', plugin: 'MarketGUI' },
    { cmd: '/shop add money 500', desc: 'Продать за валюту', plugin: 'MarketGUI' },
    { cmd: '/shop sell', desc: 'Свои товары', plugin: 'MarketGUI' },
    { cmd: '/auc', desc: 'Аукцион', plugin: 'AuctionHouse' },
    { cmd: '/auc add 100 60', desc: 'Выставить', plugin: 'AuctionHouse' },
    { cmd: '/auc bid 1 200', desc: 'Ставка', plugin: 'AuctionHouse' },
    { cmd: '/bounty Steve 5000', desc: 'Награда', plugin: 'Bounty' },
    { cmd: '/bounty list', desc: 'Топ целей', plugin: 'Bounty' },
    { cmd: '/bounty menu', desc: 'GUI', plugin: 'Bounty' },
    { cmd: '/roll', desc: 'Казино', plugin: 'RollGame' },
    { cmd: '/roll slots 1000', desc: 'Слоты', plugin: 'RollGame' },
    { cmd: '/roll duel 1000', desc: 'Дуэль', plugin: 'RollGame' },
    { cmd: '/roll mines 1000 3 5', desc: 'Мины', plugin: 'RollGame' },
    { cmd: '/roll wheel 1000', desc: 'Колесо', plugin: 'RollGame' },
    { cmd: '/roll stairs 1000', desc: 'Лестница', plugin: 'RollGame' },
    { cmd: '/roll poker', desc: 'Покер', plugin: 'RollGame' },
    { cmd: '/roll poker tables', desc: 'Столы', plugin: 'RollGame' },
    { cmd: '/roll poker create 5000', desc: 'Создать стол', plugin: 'RollGame' },
    { cmd: '/roll poker join 1', desc: 'Войти за стол', plugin: 'RollGame' },
    { cmd: '/roll poker top', desc: 'Топ покера', plugin: 'RollGame' },
    { cmd: '/roll bet 1000', desc: 'Ставка', plugin: 'RollGame' },
    { cmd: '/roll jackpot', desc: 'Джекпот', plugin: 'RollGame' },
    { cmd: '/roll stats', desc: 'Статистика', plugin: 'RollGame' },
    { cmd: '/roll top', desc: 'Топ игроков', plugin: 'RollGame' },
    { cmd: '/bal', desc: 'Баланс', plugin: 'EssentialsX' },
    { cmd: '/pay Steve 1000', desc: 'Перевод', plugin: 'EssentialsX' },
    { cmd: '/baltop', desc: 'Топ богачей', plugin: 'EssentialsX' },
    { cmd: '/sell hand', desc: 'Продать из руки', plugin: 'EssentialsX' },
    { cmd: '/sell all', desc: 'Продать всё', plugin: 'EssentialsX' },
    { cmd: '/worth', desc: 'Цена предмета', plugin: 'EssentialsX' },
    { cmd: '/sethome', desc: 'Поставить дом', plugin: 'EssentialsX' },
    { cmd: '/home', desc: 'Домой', plugin: 'EssentialsX' },
    { cmd: '/spawn', desc: 'Спавн', plugin: 'EssentialsX' },
    { cmd: '/tpa Steve', desc: 'Запрос ТП', plugin: 'EssentialsX' },
    { cmd: '/jobs browse', desc: 'Профессии', plugin: 'Jobs' },
    { cmd: '/jobs stats', desc: 'Статистика', plugin: 'Jobs' },
    { cmd: '/jobs leave', desc: 'Уволиться', plugin: 'Jobs' },
    { cmd: '/skin Steve', desc: 'Скин', plugin: 'SkinsRestorer' },
    { cmd: '/skins', desc: 'Меню скинов', plugin: 'SkinsRestorer' },
    { cmd: '/skin set 12345', desc: 'Mineskin', plugin: 'SkinsRestorer' }
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
    const inp = document.getElementById('cmd-search');
    if (!inp) return;
    inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        document.querySelectorAll('.command-item').forEach(item => {
            item.classList.toggle('hidden', q.length > 0 && !item.textContent.toLowerCase().includes(q));
        });
    });
}

// ==================== UTILS ====================

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
    const s = sec % 60;
    if (d > 0) return h > 0 ? `${d}д ${h}ч` : `${d}д`;
    if (h > 0) return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
    if (m > 0) return `${m}м`;
    return `${s}с`;
}

function timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'только что';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч назад`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} дн назад`;
    return `${Math.floor(d / 30)} мес назад`;
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
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
