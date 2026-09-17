/* ============================================================
   v5.8: загрузчик гайда из отдельного файла guide.html
   ============================================================
   Вставить в app.js.

   1. В DOMContentLoaded добавь вызов loadGuide() рядом с остальными
      инициализациями:

      loadGuide();

   2. Пропустить вызов initGuideNav() в общем цикле инициализации —
      он вызывается ВНУТРИ loadGuide() после вставки DOM.

   3. Если у тебя в списке инициализации сейчас стоит 'initGuideNav' —
      убери его оттуда, иначе будет вызван дважды.
   ============================================================ */

var GUIDE_URL = 'guide.html';
var guideLoaded = false;
var guideLoadingPromise = null;

/**
 * Загружает guide.html в #guide-content и инициализирует навигацию.
 * Идемпотентно — повторные вызовы возвращают тот же promise.
 */
function loadGuide() {
    if (guideLoadingPromise) return guideLoadingPromise;

    var container = document.getElementById('guide-content');
    if (!container) {
        console.warn('[Guide] #guide-content не найден в DOM');
        return Promise.resolve();
    }

    var url = GUIDE_URL + '?v=' + APP_VERSION;
    container.innerHTML = '<div class="empty-hint">⏳ Загрузка гайда...</div>';

    guideLoadingPromise = fetch(url, { cache: 'no-cache' })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(function (html) {
            container.innerHTML = html;
            guideLoaded = true;

            // Пересобираем навигацию по загруженному контенту.
            var nav = document.getElementById('guide-nav');
            if (nav) {
                // Оставляем только заголовок, сносим остальные ссылки (могли остаться от старой загрузки).
                var links = nav.querySelectorAll('a');
                links.forEach(function (a) { a.remove(); });
            }
            try { initGuideNav(); } catch (e) { console.error('[Guide] initGuideNav:', e); }
            try { initCommandCopy(); } catch (e) { /* уже был инициализирован */ }
        })
        .catch(function (err) {
            console.error('[Guide] Не удалось загрузить guide.html:', err);
            container.innerHTML =
                '<div class="empty-hint" style="color:#ef4444;">' +
                '❌ Не удалось загрузить гайд: ' + escapeHtml(err.message) + '<br>' +
                'Проверь, что файл <code>guide.html</code> лежит в корне репозитория.' +
                '</div>';
            guideLoadingPromise = null;
        });

    return guideLoadingPromise;
}

// Экспорт для возможного повторного вызова (например, после сброса кэша).
window.loadGuide = loadGuide;
