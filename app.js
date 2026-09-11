/**
 * Веб-панель Sovereignty: данные + интерактивная карта территорий.
 * Зум работает к позиции курсора — карта не «прыгает».
 */

const DATA_URL = 'data/server1.json';
const MAP_URL = 'data/map.png';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let currentData = null;
let currentSort = 'claims';
let mapZoom = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let highlightedCountry = null;

const PALETTE = [
    '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
    '#a855f7', '#f43f5e', '#22d3ee', '#a3e635', '#facc15',
    '#fb923c', '#e879f9', '#4ade80', '#60a5fa', '#fca5a5'
];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header-meta');
    if (header) {
        const btn = document.createElement('button');
        btn.className = 'badge';
        btn.style.cursor = 'pointer';
        btn.textContent = '🔄 Обновить';
        btn.onclick = () => { loadData(); loadMap(); };
        header.appendChild(btn);
    }

    loadData();
    setInterval(loadData, REFRESH_INTERVAL_MS);
    initMapControls();

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSort = tab.dataset.sort;
            renderCountries();
        });
    });
});

// ==================== ЗАГРУЗКА ДАННЫХ ====================

async function loadData() {
    const tbody = document.getElementById('countries-body');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">⏳ Загрузка данных...</td></tr>';

    try {
        const url = DATA_URL + '?t=' + Date.now();
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} — файл data/server1.json не найден.`);
        }
        const text = await response.text();
        if (!text || text.trim().length === 0) {
            throw new Error('Файл data/server1.json пустой.');
        }
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
        tbody.innerHTML = `
            <tr><td colspan="8" class="loading" style="text-align:left;padding:20px;color:#ef4444;">
                <strong>❌ Не удалось загрузить данные</strong><br><br>
                <strong>Причина:</strong> ${escapeHtml(err.message)}<br><br>
                Проверьте: <a href="${DATA_URL}" target="_blank" style="color:#818cf8;">${DATA_URL}</a>
            </td></tr>
        `;
    }
}

function loadMap() {
    const img = document.getElementById('map-canvas');
    const placeholder = document.getElementById('map-placeholder');

    const testImg = new Image();
    testImg.onload = () => {
        const wasHidden = img.style.display === 'none';
        img.src = MAP_URL + '?t=' + Date.now();
        img.style.display = 'block';
        placeholder.style.display = 'none';
        // Сброс вида только если карта была скрыта (первая загрузка)
        if (wasHidden) {
            setTimeout(resetMapView, 150);
        }
    };
    testImg.onerror = () => {
        img.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerHTML = `
            <div class="map-placeholder-icon">🗺️</div>
            <p>Карта ещё не сгенерирована.</p>
            <p style="font-size:12px;margin-top:8px;">Файл: <a href="${MAP_URL}" target="_blank" style="color:#818cf8;">${MAP_URL}</a></p>
        `;
    };
    testImg.src = MAP_URL + '?t=' + Date.now();
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
    document.getElementById('countries-count').textContent = countries.length;
    document.getElementById('total-claims').textContent =
        countries.reduce((sum, c) => sum + (c.claims || 0), 0).toLocaleString('ru-RU');
    document.getElementById('total-bank').textContent =
        formatMoney(countries.reduce((sum, c) => sum + (c.bank || 0), 0));
    document.getElementById('total-energy').textContent =
        countries.reduce((sum, c) => sum + (c.energy || 0), 0).toFixed(1);

    renderCountries();
    renderLegend();
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
    const country = (currentData.countries || []).find(c => c.name === countryName);
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

// ==================== КАРТА (PAN + ZOOM К КУРСОРУ) ====================

function initMapControls() {
    const viewport = document.getElementById('map-viewport');
    const img = document.getElementById('map-canvas');

    viewport.addEventListener('mousedown', (e) => {
        if (img.style.display === 'none') return;
        isDragging = true;
        dragStartX = e.clientX - mapOffsetX;
        dragStartY = e.clientY - mapOffsetY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        mapOffsetX = e.clientX - dragStartX;
        mapOffsetY = e.clientY - dragStartY;
        applyMapTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    viewport.addEventListener('wheel', (e) => {
        if (img.style.display === 'none') return;
        e.preventDefault();

        const rect = viewport.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        // Точка на изображении под курсором (в его «собственных» координатах)
        const imgX = (cursorX - mapOffsetX) / mapZoom;
        const imgY = (cursorY - mapOffsetY) / mapZoom;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.15, Math.min(10, mapZoom * delta));

        // Сдвигаем offset так, чтобы курсор остался на той же точке
        mapZoom = newZoom;
        mapOffsetX = cursorX - imgX * mapZoom;
        mapOffsetY = cursorY - imgY * mapZoom;

        applyMapTransform();
    }, { passive: false });

    document.getElementById('map-reset').addEventListener('click', resetMapView);
}

function applyMapTransform() {
    const img = document.getElementById('map-canvas');
    img.style.transform = `translate(${mapOffsetX}px, ${mapOffsetY}px) scale(${mapZoom})`;
}

function resetMapView() {
    const img = document.getElementById('map-canvas');
    const viewport = document.getElementById('map-viewport');
    if (!img.complete || img.naturalWidth === 0) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(vw / iw, vh / ih) * 0.98;
    mapZoom = scale;
    mapOffsetX = (vw - iw * scale) / 2;
    mapOffsetY = (vh - ih * scale) / 2;
    applyMapTransform();
}

// ==================== УТИЛИТЫ ====================

function formatMoney(amount) {
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
    if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'k';
    return Math.round(amount).toString();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
