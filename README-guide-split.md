# Как вынести гайд в отдельный файл

## Что сделано

Гайд теперь лежит в отдельном `guide.html` и подгружается через `fetch()` в `index.html`.
Плюсы:

- `index.html` стал тонким (меньше 5k строк) — с ним можно работать в git и IDE.
- Гайд редактируется отдельно, не задевая остальную страницу.
- Кэш браузера обновляется независимо — если ты правишь только гайд,
  браузер подгрузит новый `guide.html`, а не весь `index.html`.

## Файлы

| Файл | Что в нём |
|---|---|
| `guide.html` | Полный контент гайда (article-блоки). Редактируй ТОЛЬКО здесь. |
| `index-guide-section.html` | Заготовка `<section id="tab-guide">` для вставки в `index.html`. |
| `app-guide-loader.js` | Функция `loadGuide()` — вставить в `app.js`. |

## Как применить

### 1. В `index.html`

Найди секцию `<section class="tab-content" id="tab-guide">` и замени её содержимое
на содержимое `index-guide-section.html`. В итоге должно быть так:

```html
<section class="tab-content" id="tab-guide">
    <div class="guide-layout">
        <aside class="guide-nav" id="guide-nav"><div class="guide-nav-title">Содержание</div></aside>
        <div id="guide-content"></div>
    </div>
</section>
```

Весь контент гайда (`<article class="guide-section">...`) уйдёт из `index.html`
в `guide.html`.

### 2. В `app.js`

**a) Добавь переменные и функцию** из `app-guide-loader.js` (в конец файла).

**b) Найди блок инициализации в `DOMContentLoaded`:**

```
['initTabs','initSortTabs','initMapControls','initMapFullscreen','initCommandCopy','initGuideNav',
 'initCommandSearch','initPlayerControls','initModalControls'].forEach(function (fn) {
    try { window[fn](); } catch (e) { console.error(fn + ':', e); }
});
```

Замени на:

```
['initTabs','initSortTabs','initMapControls','initMapFullscreen','initCommandCopy',
 'initCommandSearch','initPlayerControls','initModalControls'].forEach(function (fn) {
    try { window[fn](); } catch (e) { console.error(fn + ':', e); }
});
loadGuide();
```

То есть **убери `initGuideNav` из списка** — он вызывается внутри `loadGuide()`.

## Что делать при редактировании гайда

1. Открой `guide.html` → правь нужный `<article>`.
2. Проверь `version.txt` — обнови, если были существенные правки.
3. Залей `guide.html` в репозиторий.
4. Пользователю: `Ctrl+Shift+R` в браузере (только для сброса кэша fetch).

`index.html` и `app.js` при правках гайда **не трогаются**.

## Что делать при добавлении новой фичи

По правилу проекта: при добавлении любой новой команды или фичи в плагин —
обнови **guide.html**, добавив новую `<article>` (или расширив существующую).
Также обнови раздел «📋 Что нового» с датой.

