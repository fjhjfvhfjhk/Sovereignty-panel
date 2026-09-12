# Favicon — Sovereignty Panel

Иконка сайта: **щит с короной и буквой S** в фирменном индиго `#6366f1`.

## Файлы

| Файл | Назначение |
|---|---|
| `favicon.svg` | Основная иконка (светлая тема браузера) |
| `favicon-dark.svg` | Для тёмной темы браузера (авто-подключение через media) |
| `site.webmanifest` | PWA-манифест (для установки как приложение) |
| `head-snippet.html` | Только строки для `<head>`, если хочешь вставить в свой index.html |

## Что уже подключено в index.html

```html
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="icon" type="image/svg+xml" href="favicon-dark.svg" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="favicon.svg">
<link rel="manifest" href="site.webmanifest">
<link rel="mask-icon" href="favicon.svg" color="#6366f1">
```

## Как это работает

1. **`favicon.svg`** — браузер рисует вектор в любом размере (16×16 до 512×512).
Один файл заменяет десяток PNG.
2. **`media="(prefers-color-scheme: dark)"`** — если у пользователя тёмная тема ОС,
подтянется `favicon-dark.svg`. Светлый щит с тёмным контуром.
3. **`apple-touch-icon`** — иконка при добавлении сайта на домашний экран iOS.
4. **`manifest`** — позволяет установить сайт как PWA-приложение (Chrome/Edge:
три точки → «Установить приложение»).

## Совместимость

| Браузер ↕▾ | SVG favicon ↕▾ |
|---|---|
| −Chrome/Edge 80+ | ✅ |
| Firefox 41+ | ✅ |
| Safari 12+ (macOS), iOS 15+ | ✅ (с fallback на apple-touch-icon) |
| Старые браузеры | ⚠️ Пустая иконка. Если критично — добавь PNG-версию (см. ниже) |
⚙

## Хочешь PNG-версию (для старых браузеров)?

1. Открой `favicon.svg` в браузере.
2. Screenshot-ом или через realfavicongenerator.net.
3. Положи PNG в `data/` и добавь:

```
<link rel="icon" type="image/png" sizes="32x32" href="data/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="data/favicon-16.png">
```

## Проверка после деплоя

1. Залей `favicon.svg`, `favicon-dark.svg`, `site.webmanifest` в корень репозитория.
2. Обнови `index.html` (или вставь head-snippet).
3. **Ctrl+Shift+R** — hard refresh, чтобы браузер сбросил кэш иконки.
4. Открой DevTools → Application → Manifest — убедись что иконка подхватилась.
5. Если не появилась — почисти кэш сайта в настройках браузера
(иногда favicon кэшируется очень упорно).

## Кастомизация

Хочешь другой символ/цвет? Меняй `favicon.svg`:

- **Буква:** строка `<text ...>S</text>` → любая другая.
- **Цвет щита:** gradient `shieldGrad` — от `#818cf8` к `#4338ca`.
- **Корона:** gradient `crownGrad` (сейчас золото `#fde047` → `#f59e0b`).
- **Форма:** path щита `M32 2 L57 11 ...` — можно сделать круг или ромб.

