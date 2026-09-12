# Панель сервера — Sovereignty

Веб-сайт с интерактивной картой, 3D-профилями игроков, полным гайдом и бонусами.

Версия панели: **4.6**

## Файлы

| Файл | Назначение |
|---|---|
| `index.html` | Разметка страницы, модалка 3D-профиля |
| `app.js` | Логика: табы, карта, игроки, спарклайн, команды, рендер |
| `map-layers.js` | Слои карты (игроки / сетка / день-ночь) |
| `skin3d.js` | Кастомный CSS-3D рендер скина (без внешних библиотек) |
| `style.css` | Всё оформление |
| `data/server1.json` | Данные, пушит плагин Sovereignty |
| `data/map.png` | Карта, пушит плагин Sovereignty |
| `data/skins/{ник}.png` | Локальные скины для пираток (опционально) |

## Что нового (v4.6)

### 🎨 Hash-цвета стран
Цвет приходит с сервера в `country.color` (FNV-1a хеш имени → HSL).
Стабилен, уникален, не повторяется при 25+ странах.
Используется в таблице, легенде карты, границах маркеров игроков.

### 📈 Спарклайн онлайна 24ч
Canvas над топом стран. Показывает «сейчас / средний / пик».
Данные — `online_history[]` в JSON (интервал 5 мин, хранение 24ч).

### 📊 Диаграмма активности
Колонка в топе + сортировка «По активности».
Формула на сервере: `delta_claims_7d × 3 + active_wars × 5`.

### 🎨 Слои карты (map-layers.js)
- 👤 **Игроки** — маркеры с головами и никами, цвет границы = цвет страны.
- 🔲 **Сетка чанков** — SVG pattern 32×32, синхронизирован по transform.
- 🌗 **День/Ночь** — overlay зависит от `map_meta.world_time` (0..24000).
  Индикатор «☀️ День • 12:34» под чекбоксами.

Состояние слоёв сохраняется в localStorage.

### 🧊 3D-профиль игрока (skin3d.js v4.7)
Кастомный CSS-3D рендер **без skinview3d и Three.js**.
- 6 базовых + 6 overlay коробок (шапка/куртка/рукава/штаны).
- Pixel-perfect: текстура пред-рендерится через canvas в нативном U.
- Overlay-зазор: `max(1, round(U/4))` px.
- Drag для вращения, авто-вращение (пауза по кнопке), сброс вида.

## Откуда берутся скины

Порядок (первый успешный выигрывает):

1. **`data/skins/{ник}.png`** — локальный файл (для пираток).
2. **`https://crafatar.com/skins/{uuid}`** — если UUID известен.
3. **`https://crafatar.com/skins/{STEVE_UUID}`** — fallback Steve.

### Как выгрузить скины для пираток

1. Возьми PNG-файл скина (64×64 или 64×32).
2. Назови **точно как ник игрока** (регистр важен): `Steve.png`, `YatoroGod.png`.
3. Положи в папку `data/skins/` в репозитории.
4. При следующем открытии профиля скин подтянется.

**Ник с недопустимыми символами?** Замени `:` и `/` на `_`.

## Обновление данных

Интервал фронта — **5 минут** (см. `REFRESH_INTERVAL_MS` в app.js).

В `webpanel.yml`:
```yaml
interval-minutes: 5
auto-push-chunk-threshold: 200
```

GitHub rate limit (Fine-grained token): 5000 запросов/час.
Каждый push = 2 запроса (get SHA + PUT).
5 мин = 12 push/час = 24 запроса/час — с огромным запасом.

## Ожидаемая структура JSON

```
{
  "updated_at": 1789155714193,
  "server_name": "Сервер",
  "online_players": 5,
  "max_players": 15,

  "map_meta": {
    "world": "world",
    "min_chunk_x": -100,
    "min_chunk_z": -100,
    "world_time": 6000,
    "world_day": 42
  },

  "online_history": [
    {"ts": 1789155714193, "count": 3}
  ],

  "countries": [
    {
      "name": "DotA",
      "color": "#794bdc",
      "owner": "YatoroGod",
      "claims": 53,
      "max_claims": 75,
      "claims_delta_7d": 10,
      "activity": 35,
      "active_wars": 1,
      "bank": 53289.0,
      "debt": 4900.0,
      "energy": 40.0,
      "max_energy": 40.0,
      "regen": 16.0,
      "farm_level": 9,
      "pacts": 0,
      "allies": 1,
      "chunks_farm": 46,
      "chunks_mining": 1,
      "chunks_military": 0,
      "chunks_trade": 0
    }
  ],

  "players": [
    {
      "uuid": "xxxx-xxxx-...",
      "name": "YatoroGod",
      "online": true,
      "country": "DotA",
      "country_color": "#794bdc",
      "country_role": "leader",
      "balance": 125000,
      "energy": 40.0,
      "max_energy": 40.0,
      "playtime_seconds": 345600,
      "first_seen": 1770000000000,
      "last_seen": 1789155714193,
      "kills": 120,
      "deaths": 15,
      "achievements_count": 8,
      "job": "Miner",
      "job_level": 42,
      "position": {
        "world": "world",
        "x": 100.5,
        "y": 64.0,
        "z": -200.5
      }
    }
  ],

  "jackpot": {"jackpot": 64243},
  "top_poker": [],
  "bounties": [],
  "wars": [],
  "tax_debts": [],
  "market_categories": {},
  "active_auctions": []
}
```

**Все поля опциональны** — если их нет, блоки не отображаются.

### Обязательные для карты маркеров

- `map_meta.min_chunk_x`, `map_meta.min_chunk_z`, `map_meta.world`
- `players[].position.x`, `players[].position.z`

### Обязательные для day/night

- `map_meta.world_time` (0..24000)

## Как развернуть

1. **Public репозиторий** `Sovereignty-panel`.
2. Залить `index.html`, `style.css`, `app.js`, `map-layers.js`,
`skin3d.js`, `README.md`.
3. Создать `data/server1.json` и `data/skins/`.
4. **Settings → Pages → main / root**.
5. **Fine-grained token** с правами `Contents: Read and write`.
6. Прописать в `plugins/Sovereignty/webpanel.yml`.
7. Перезапустить сервер.

## Зависимости

Внешних библиотек **нет**. Всё на чистом JS/CSS.
Скины грузятся с `crafatar.com` (если нет локального файла).

## Безопасность

⚠️ Токен — только в `webpanel.yml`, никогда не коммить в Git.

## Troubleshooting

| Проблема ↕▾ | Решение ↕▾ |
|---|---|
| −«Ошибка загрузки» | Проверь `data/server1.json` |
| −GitHub API 401 | Токен истёк — создай новый |
| −GitHub API 404 | Неверный owner/repo/path |
| Pages 404 | Подожди 1–2 минуты после первого билда |
| Скины не грузятся | Проверь `data/skins/{ник}.png` или `crafatar.com` |
| 3D-модель не появляется | F12 → Console, проверь что `skin3d.js` подключён |
| Маркеры не видны | Убедись, что в JSON есть `map_meta` и `players[].position` |
| Спарклайн пустой | Нужен `online_history[]` в JSON (минимум 2 точки) |
⚙

