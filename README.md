# Панель сервера — Sovereignty

Веб-сайт с интерактивной картой, 3D-профилями игроков, полным гайдом и бонусами.

## Что нового (v2)

### 3D-профиль игрока
При клике на игрока открывается модалка:
- **Слева** — 3D-модель скина (skinview3d / Three.js). **Можно крутить мышью**, зум колёсиком.
- Кнопки под моделью: **пауза вращения**, **сброс камеры**, **показать/скрыть ник над головой**.
- **Справа** — статы в виде строк «ключ — значение»:
  - **Основное**: UUID, баланс, время в игре, последний вход, первый вход, профессия, K/D
  - **Страна**: страна, роль (лидер/соправитель), казна страны, территория, награда за голову
  - **Активность**: энергия, макс. энергия, достижения, дней в игре, локация

### Маркеры игроков на карте
На карте территорий отображаются **головы игроков** с ником снизу.
- Онлайн — зелёная рамка и зелёная плашка.
- Оффлайн — серая рамка.
- Клик по маркеру — открывает 3D-профиль.
- В шапке карты — чекбокс **👤 Игроки** для показа/скрытия.
- В модалке игрока есть кнопка **🗺️ Показать на карте** — центрирует карту на игроке и зумит.

## Откуда берутся скины

Порядок (первый успешный выигрывает):
1. **`data/skins/{ник}.png`** — локальный файл. Для пираток — ты выгружаешь скины вручную (см. ниже).
2. **`https://mc-heads.net/skin/{ник}`** — Mojang API (лицензионные аккаунты).
3. **`https://mc-heads.net/skin/Steve`** — фоллбэк.

### Как выгрузить скины для пираток
1. Возьми PNG-файл скина (64×64 или 64×32).
2. Назови его **точно как ник игрока** (регистр важен): `Steve.png`, `YatoroGod.png`.
3. Положи в папку `data/skins/` в репозитории.
4. Готово — при следующем открытии профиля скин подтянется.

**Ник с недопустимыми символами?** Если ник содержит `:` или `/` — переименуй файл, заменив проблемные символы на `_`. Или попроси игрока сменить ник.

## Обновление данных (важно!)

Интервал обновления фронта — **1 минута** (для актуальности позиций игроков).

GitHub rate limit:
- Fine-grained token: **5000 запросов/час**
- Каждый push = 2 запроса (get SHA + PUT)
- 1 минута = 60 push = 120 запросов/час — влезает с огромным запасом.

В `webpanel.yml` установи:
```yaml
interval-minutes: 1
auto-push-chunk-threshold: 0   # отключаем, чтобы не было лишних пушей
```

Или используй cron на сервере — вызывай `/country panel push` раз в минуту.

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
    "min_chunk_z": -100
  },

  "countries": [ /* ... как было ... */ ],

  "players": [
    {
      "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "YatoroGod",
      "country": "DotA",
      "country_role": "leader",
      "online": true,
      "playtime_seconds": 345600,
      "balance": 125000,
      "job": "Miner",
      "job_level": 42,
      "last_seen": 1789155714193,
      "first_seen": 1770000000000,
      "kills": 120,
      "deaths": 15,
      "energy": 40.0,
      "max_energy": 40.0,
      "achievements_count": 8,
      "bounty": 0,
      "position": {
        "world": "world",
        "x": 100.5,
        "y": 64.0,
        "z": -200.5
      }
    }
  ]
}
```

**Все поля опциональны** — если их нет, соответствующие блоки не отобразятся.

### Обязательные для карты маркеров:

- `map_meta.min_chunk_x`, `map_meta.min_chunk_z`, `map_meta.world`
- `players[].position.x`, `players[].position.z`

Без `map_meta` маркеры просто не покажутся (но 3D-профиль будет работать).

## Как получить `min_chunk_x` и `min_chunk_z` в плагине

Они вычисляются в `MapRenderer.renderMap()`:

```
// После обхода всех чанков:
// minCX, minCZ — минимальные координаты чанков
// После вычитания PADDING_CHUNKS (=15):
int finalMinCX = minCX - 15;
int finalMinCZ = minCZ - 15;

// Добавь в JSON:
root.put("map_meta", Map.of(
    "world", worldName,
    "min_chunk_x", finalMinCX,
    "min_chunk_z", finalMinCZ
));
```

## Как получить `players[]` в плагине

В `WebPanelUploader.buildJson()`:

```
List<Map<String, Object>> playersList = new ArrayList<>();
for (Player p : Bukkit.getOnlinePlayers()) {
    Map<String, Object> pm = new LinkedHashMap<>();
    pm.put("uuid", p.getUniqueId().toString());
    pm.put("name", p.getName());
    pm.put("online", true);

    String country = countryManager.getCountryName(p.getUniqueId());
    if (country != null) {
        pm.put("country", country);
        if (countryManager.isLeader(p.getUniqueId(), country))
            pm.put("country_role", "leader");
        else if (countryManager.isCoRuler(p.getUniqueId(), country))
            pm.put("country_role", "co_ruler");
    }

    pm.put("balance", economyManager.getBalance(p));
    pm.put("energy", energyManager.getEnergy(p.getUniqueId()));
    pm.put("max_energy", energyManager.getMaxEnergy(p.getUniqueId()));

    Location loc = p.getLocation();
    pm.put("position", Map.of(
        "world", loc.getWorld().getName(),
        "x", loc.getX(),
        "y", loc.getY(),
        "z", loc.getZ()
    ));

    // playtime_seconds, first_seen, last_seen — из твоей статистики
    playersList.add(pm);
}
root.put("players", playersList);
```

## Как развернуть

1. **Public репозиторий** `Sovereignty-panel`
2. Залить `index.html`, `style.css`, `app.js`, `README.md`
3. Создать `data/server1.json` и `data/skins/` (папка для локальных скинов)
4. **Settings → Pages → main / root**
5. **Fine-grained token** с правами `Contents: Read and write`
6. Прописать в `plugins/Sovereignty/webpanel.yml`
7. Перезапустить сервер

## Зависимости

- **skinview3d** (CDN unpkg) — 3D-рендер скина.
- **mc-heads.net** — API скинов и аватарок.

Если skinview3d не загрузится (нет интернета / CDN блок) — 3D-модель покажет ошибку, но остальная панель работает.

## Безопасность

⚠️ Токен — только в `webpanel.yml`, никогда не коммить в Git.

## Troubleshooting

| Проблема ↕▾ | Решение ↕▾ |
|---|---|
| −«Ошибка загрузки» | Проверь `data/server1.json` |
| −GitHub API 401 | Токен истёк — создай новый |
| −GitHub API 404 | Неверный owner/repo/path |
| −Pages 404 | Подожди 1-2 минуты после первого билда |
| −Скины не грузятся | Проверь `mc-heads.net` в браузере |
| −3D-модель не появляется | Открой F12 → Console, проверь ошибки skinview3d |
| −Маркеры не видны | Убедись, что |
⚙
