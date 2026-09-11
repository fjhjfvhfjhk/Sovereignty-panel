# Панель сервера — Sovereignty

Веб-сайт с интерактивной картой, карточками игроков со скинами, полным гайдом,
списком команд и условными бонусными секциями.

## Возможности

### Табы
- 🏠 **Обзор** — статистика, топ стран, детальная карточка
- 🗺️ **Карта** — pan / zoom / клик по стране (определение через canvas)
- 👥 **Игроки** — карточки со скинами, поиск, фильтр «только онлайн», модалка
- 📖 **Гайд** — 13 разделов с anchor-навигацией и scroll-spy
- ⌨️ **Команды** — ~90 команд с поиском, клик — копирует
- 🎁 **Бонусы** — джекпот, события, войны, топ покера, наёмники (условно)

### Скины игроков
Скины подтягиваются с **mc-heads.net** по нику:
- Аватарка в списке: `https://mc-heads.net/avatar/{name}/64`
- Тело в модалке: `https://mc-heads.net/body/{name}/256`

Работает и для пиратки — если у игрока нет скина на Mojang, отдаётся Steve/Alex.
При ошибке загрузки — фоллбэк на аватарку Steve.

### Модалка игрока
Клик по карточке → открывается центр-модалка:
- **Слева** — большое изображение скина (тело) + аватарка
- **Справа** — статы: UUID, баланс, время в игре, последний вход, профессия, K/D
- Раздел **Страна**: страна, роль (лидер/соправитель), казна, территория, награда за голову
- Раздел **Активность**: энергия, первый вход, достижения, дней в игре
- Кнопки: «Перейти к стране», «Скопировать ник»

## Ожидаемая структура JSON

### Игроки
```json
"players": [
  {
    "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "Steve",
    "country": "DotA",
    "country_role": "leader",
    "playtime_seconds": 123456,
    "balance": 50000,
    "job": "Miner",
    "job_level": 15,
    "last_seen": 1789155714193,
    "first_seen": 1780000000000,
    "online": true,
    "kills": 42,
    "deaths": 7,
    "energy": 40.0,
    "max_energy": 40.0,
    "achievements_count": 8,
    "bounty": 0
  }
]
```

Поля опциональны — если их нет, соответствующие блоки просто не отображаются.

### Бонусы (опционально)

```
{
  "jackpot": 1234567,
  "events": [{ "name": "Урожайный сезон", "description": "Доход ферм +75%", "type": "positive" }],
  "wars": [{ "attacker": "DotA", "defender": "Норвегия", "started_at": 1789000000000 }],
  "top_poker": [{ "name": "Steve", "profit": 50000, "hands": 15 }],
  "bounties": [{ "target": "YatoroGod", "amount": 10000 }]
}
```

Секции скрыты, пока нет соответствующих полей.

## Как развернуть

1. **Создай Public репозиторий** `Sovereignty-panel`
2. Залить `index.html`, `style.css`, `app.js`, `README.md`
3. Создать `data/server1.json`:

```
{"updated_at":0,"server_name":"Ожидание","countries":[],"players":[]}
```
4. **Settings → Pages → main / root**
5. **Fine-grained token** с правами `Contents: Read and write`
6. Прописать в `plugins/Sovereignty/webpanel.yml`
7. Перезапустить сервер

## Что нужно добавить в плагин (когда руки дойдут)

В `WebPanelUploader.buildJson()` добавить блок:

```
// Игроки
List<Map<String, Object>> playersList = new ArrayList<>();
for (Player p : Bukkit.getOnlinePlayers()) {
    Map<String, Object> pm = new LinkedHashMap<>();
    pm.put("uuid", p.getUniqueId().toString());
    pm.put("name", p.getName());
    pm.put("online", true);

    String country = plugin.getCountryManager().getCountryName(p.getUniqueId());
    pm.put("country", country != null ? country : null);
    if (country != null) {
        if (plugin.getCountryManager().isLeader(p.getUniqueId(), country)) {
            pm.put("country_role", "leader");
        } else if (plugin.getCountryManager().isCoRuler(p.getUniqueId(), country)) {
            pm.put("country_role", "co_ruler");
        }
    }
    pm.put("balance", plugin.getEconomyManager().getBalance(p));
    // ... playtime, job, kills и т.д. из своих источников
    playersList.add(pm);
}
root.put("players", playersList);
```

Аналогично для бонусов. Фронт сам подхватит и покажет.

## Безопасность

⚠️ Токен — только в `webpanel.yml`, никогда не коммить в Git.

## Troubleshooting

| Проблема ↕▾ | Решение ↕▾ |
|---|---|
| −«Ошибка загрузки» | Проверь `data/server1.json` через ссылку в ошибке |
| −GitHub API 401 | Токен истёк — создай новый |
| −GitHub API 404 | Неверный owner / repo / path |
| −Pages 404 | Подожди 1-2 минуты после первого билда |
| −Скины не грузятся | Проверь `mc-heads.net` в браузере (может быть блок) |
| −Карта не кликается | PNG должен отдаваться с того же домена для canvas |
⚙

