# Панель сервера — Sovereignty

Веб-сайт для отображения данных плагина Sovereignty: топ стран, территории, казна, энергия, союзы.

## Как развернуть за 5 минут

### 1. Создайте репозиторий на GitHub

- Название: например, `my-server-panel`
- Тип: **Public** (обязательно, иначе GitHub Pages не будет работать на бесплатном тарифе)
- Не добавляйте README (мы зальём свой)

### 2. Залейте файлы

Загрузите в репозиторий все файлы из этой папки (`index.html`, `style.css`, `app.js`).

Создайте папку `data` и положите туда пустой файл `server1.json`:
```json
{"updated_at":0,"server_name":"Ожидание данных","countries":[]}
```

### 3. Включите GitHub Pages

- Зайдите в **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: **main**, folder: **/ (root)**
- Нажмите Save

Через 1-2 минуты сайт будет доступен по адресу:
`https://ваш-логин.github.io/my-server-panel/`

### 4. Создайте токен для плагина

- GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
- Нажмите **Generate new token**
- Repository access: **Only select repositories** → выберите ваш `my-server-panel`
- Permissions → Repository permissions → **Contents: Read and write**
- Скопируйте токен (вида `github_pat_...`)

### 5. Настройте плагин

В папке `plugins/Sovereignty/` найдите файл `webpanel.yml` и заполните:

```
enabled: true
server-name: "Ваш сервер"
interval-minutes: 60
github:
  owner: "ваш-логин"
  repo: "my-server-panel"
  branch: "main"
  path: "data/server1.json"
  token: "github_pat_..."
```

### 6. Перезапустите сервер

При старте плагин:

- Сразу отправит данные на GitHub (через 5 сек)
- Будет отправлять обновления каждый час
- Отправит финальные данные при выключении

Также можно вручную: `/country panel push`

## Что показывается на сайте

- 🏛️ Общее количество стран
- 🗺️ Суммарная территория
- 💰 Общая казна всех стран
- ⚡ Суммарная энергия всех лидеров
- 🏆 Топ стран с сортировкой: территория, казна, энергия, союзы
- 📊 Детали страны при клике (уровни ферм, тип чанков, долг)

## Авто-обновление

Сайт сам перезагружает данные каждые 5 минут. Сервер присылает свежие данные раз в час.

## Безопасность

⚠️ **Никогда не коммитьте токен в Git!** Токен хранится только в `plugins/Sovereignty/webpanel.yml` на вашем сервере.

Используйте **fine-grained token** с доступом только к этому репозиторию (Repository access → Only select repositories).

## Troubleshooting

**Сайт показывает «Ошибка загрузки»**
→ Проверьте, что файл `data/server1.json` существует и валиден.
→ Откройте консоль браузера (F12) и посмотрите, что именно не так.

**Плагин пишет «GitHub API ответил 401»**
→ Токен неверный или просрочен. Создайте новый.

**Плагин пишет «GitHub API ответил 404»**
→ Неверный owner/repo или path. Проверьте настройки.

**GitHub Pages отдаёт 404**
→ Подождите 1-2 минуты после включения Pages (первый билд).

**Данные не обновляются**
→ Проверьте логи сервера, ищите «[WebPanel]». Возможно, истёк токен.

