/**
 * Веб-панель Sovereignty.
 * Загружает JSON-файл, сгенерированный плагином, и рендерит данные.
 */

// ==================== НАСТРОЙКИ ====================

// Путь к JSON-файлу в репозитории (относительный, чтобы работало на GitHub Pages)
const DATA_URL = 'data/server1.json';

// Интервал автообновления (5 минут)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// ==================== СОСТОЯНИЕ ====================

let currentData = null;
let currentSort = 'claims';

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, REFRESH_INTERVAL_MS);

    // Привязка табов
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
    try {
        // Cache-busting
        const url = DATA_URL + '?t=' + Date.now();
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        currentData = await response.json();
        render();
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        document.getElementById('server-name').textContent = 'Ошибка загрузки';
        document.getElementById('countries-body').innerHTML =
            '<tr><td colspan="8" class="loading">❌ Не удалось загрузить данные. Проверьте, что плагин отправил их.</td></tr>';
    }
}

// ==================== РЕНДЕР ====================

function render() {
    if (!currentData) return;

    // Шапка
    document.getElementById('server-name').textContent = currentData.server_name || 'Сервер';
    document.getElementById('online-badge').textContent =
        `Онлайн: ${currentData.online_players || 0} / ${currentData.max_players || 0}`;

    const updated = currentData.updated_at;
    if (updated) {
        const date = new Date(updated);
        const minutes = Math.floor((Date.now() - updated) / 60000);
        const ago = minutes < 1 ? 'только что'
            : minutes < 60 ? `${minutes} мин назад`
            : `${Math.floor(minutes / 60)} ч назад`;
        document.getElementById('updated-badge').textContent = `Обновлено: ${ago}`;
    }

    // Сводка
    const countries = currentData.countries || [];
    document.getElementById('countries-count').textContent = countries.length;
    document.getElementById('total-claims').textContent =
        countries.reduce((sum, c) => sum + (c.claims || 0), 0).toLocaleString('ru-RU');
    document.getElementById('total-bank').textContent =
        formatMoney(countries.reduce((sum, c) => sum + (c.bank || 0), 0));
    document.getElementById('total-energy').textContent =
        countries.reduce((sum, c) => sum + (c.energy || 0), 0).toFixed(1);

    renderCountries();
}

function renderCountries() {
    if (!currentData) return;
    const countries = [...(currentData.countries || [])];

    // Сортировка
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
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Пока нет стран на сервере.</td></tr>';
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
