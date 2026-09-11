/**
 * Веб-панель Sovereignty.
 *
 * - Табы: Обзор / Карта / Игроки / Гайд / Команды / Бонусы
 * - Карта (canvas + click по стране + маркеры игроков)
 * - 3D-профиль игрока (skinview3d, можно крутить мышью)
 * - Копирование команд в буфер
 * - Условные секции Бонусов
 *
 * Скины:
 *   1) data/skins/{name}.png    — локальный файл (пиратки)
 *   2) mc-heads.net/skin/{name} — Mojang
 *   3) mc-heads.net/skin/Steve  — фоллбэк
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

let currentSkinViewer = null;
let currentRotateAnim = null;
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
        try { currentSkinViewer.dispose(); } catch (e) { /* ignore */ }
        currentSkinViewer = null;
    }
    currentRotateAnim = null;
    rotatePaused = false;
   
