/* skin3d.js — CSS 3D Minecraft skin viewer v4.6
 * ============================================================
 * ФИКСЫ v4.6 vs v4.5:
 *   - Убран ДВОЙНОЙ url(...) в background-image. Раньше получалось
 *     url(url("data:image/png;...")) — невалидный CSS, браузер молча
 *     игнорировал → скин не отображался (но боксы в DOM были).
 *   - Возвращён perspective на сцену (был в v4.2, пропал в v4.5).
 *   - Чистка image-rendering (было два подряд — второе перезаписывало первое).
 * ============================================================ */
(function () {
    'use strict';

    var UV_BASE = {
        head:     { f: [8,8],   r: [0,8],   l: [16,8],  b: [24,8],  t: [8,0],   bo: [16,0]  },
        body:     { f: [20,20], r: [16,20], l: [28,20], b: [32,20], t: [20,16], bo: [28,16] },
        rightArm: { f: [44,20], r: [40,20], l: [48,20], b: [52,20], t: [44,16], bo: [48,16] },
        leftArm:  { f: [36,52], r: [32,52], l: [40,52], b: [44,52], t: [36,48], bo: [40,48] },
        rightLeg: { f: [4,20],  r: [0,20],  l: [8,20],  b: [12,20], t: [4,16],  bo: [8,16]  },
        leftLeg:  { f: [20,52], r: [16,52], l: [24,52], b: [28,52], t: [20,48], bo: [24,48] }
    };

    var UV_OVERLAY = {
        head:     { f: [40,8],  r: [32,8],  l: [48,8],  b: [56,8],  t: [40,0],  bo: [48,0]  },
        body:     { f: [20,36], r: [16,36], l: [28,36], b: [32,36], t: [20,32], bo: [28,32] },
        rightArm: { f: [44,36], r: [40,36], l: [48,36], b: [52,36], t: [44,32], bo: [48,32] },
        leftArm:  { f: [52,52], r: [48,52], l: [56,52], b: [60,52], t: [52,48], bo: [56,48] },
        rightLeg: { f: [4,36],  r: [0,36],  l: [8,36],  b: [12,36], t: [4,32],  bo: [8,32]  },
        leftLeg:  { f: [4,52],  r: [0,52],  l: [8,52],  b: [12,52], t: [4,48],  bo: [8,48]  }
    };

    var PARTS = [
        { name: 'head',     w: 8, h: 8,  d: 8, cx: 0,  cy: 12 },
        { name: 'body',     w: 8, h: 12, d: 4, cx: 0,  cy: 2  },
        { name: 'rightArm', w: 4, h: 12, d: 4, cx: -6, cy: 2  },
        { name: 'leftArm',  w: 4, h: 12, d: 4, cx: 6,  cy: 2  },
        { name: 'rightLeg', w: 4, h: 12, d: 4, cx: -2, cy: -10 },
        { name: 'leftLeg',  w: 4, h: 12, d: 4, cx: 2,  cy: -10 }
    ];

    function computeU(wrap) {
        var w = wrap.clientWidth || 380;
        var h = wrap.clientHeight || 380;
        var m = Math.min(w, h);
        var u = Math.floor((m * 0.72) / 32);
        if (u < 6) u = 6;
        if (u > 24) u = 24;
        return u;
    }

    /* texUrl — СЫРОЙ data URL (начинается с "data:image/png;base64,..."). Оборачиваем в url() ЗДЕСЬ, один раз. */
    function makeFace(texUrl, texW, texH, U, uv, fw, fh, transform) {
        var d = document.createElement('div');
        d.style.position = 'absolute';
        d.style.left = '0';
        d.style.top = '0';
        d.style.width = (fw * U) + 'px';
        d.style.height = (fh * U) + 'px';
        d.style.backgroundImage = 'url("' + texUrl + '")';
        d.style.backgroundSize = texW + 'px ' + texH + 'px';
        d.style.backgroundPosition = (-uv[0] * U) + 'px ' + (-uv[1] * U) + 'px';
        d.style.backgroundRepeat = 'no-repeat';
        d.style.imageRendering = 'pixelated';
        d.style.transform = 'translate(-50%, -50%) ' + transform;
        d.style.transformOrigin = 'center';
        d.style.backfaceVisibility = 'hidden';
        return d;
    }

    function makeBox(texUrl, texW, texH, U, uv, w, h, d, cx, cy, inflate) {
        inflate = inflate | 0;
        var box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.left = '0';
        box.style.top = '0';
        box.style.width = '0';
        box.style.height = '0';
        box.style.transformStyle = 'preserve-3d';
        box.style.transform = 'translate3d(' + (cx * U) + 'px,' + (-cy * U) + 'px,0)';

        var W = w * U, H = h * U, D = d * U, INF = inflate * U;
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.f,  w, h, 'translateZ(' + (D/2 + INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.b,  w, h, 'rotateY(180deg) translateZ(' + (D/2 + INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.r,  d, h, 'rotateY(90deg) translateZ(' + (W/2 + INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.l,  d, h, 'rotateY(-90deg) translateZ(' + (W/2 + INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.t,  w, d, 'rotateX(90deg) translateZ(' + (H/2 + INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.bo, w, d, 'rotateX(-90deg) translateZ(' + (H/2 + INF) + 'px)'));
        return box;
    }

    function build(img, name, wrap) {
        var U = computeU(wrap);
        var isModern = img.height >= 64;

        // Пред-рендер текстуры в нативном разрешении (пиксель-перфект).
        var tc = document.createElement('canvas');
        tc.width = img.width * U;
        tc.height = img.height * U;
        var tctx = tc.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0, tc.width, tc.height);

        var texUrl;
        try {
            // ВАЖНО: сырой data URL, БЕЗ url(...) — оборачивать будем в makeFace.
            texUrl = tc.toDataURL('image/png');
        } catch (e) {
            // Tainted canvas: CDN не отдал CORS. Используем прямой URL изображения.
            console.warn('[skin3d] toDataURL failed (tainted canvas), fallback to img.src: ' + e.message);
            texUrl = img.src;
        }
        var texW = img.width * U, texH = img.height * U;

        var scene = document.createElement('div');
        scene.className = 'skin-scene';
        scene.style.position = 'absolute';
        scene.style.inset = '0';
        scene.style.overflow = 'hidden';
        scene.style.cursor = 'grab';
        scene.style.userSelect = 'none';
        scene.style.perspective = '2000px';        // ← вернули
        scene.style.perspectiveOrigin = '50% 50%';

        var figure = document.createElement('div');
        figure.className = 'skin-figure';
        var sw = wrap.clientWidth || 380, sh = wrap.clientHeight || 380;
        figure.style.position = 'absolute';
        figure.style.left = Math.floor(sw / 2) + 'px';
        figure.style.top = Math.floor(sh / 2) + 'px';
        figure.style.width = '0';
        figure.style.height = '0';
        figure.style.transformStyle = 'preserve-3d';
        scene.appendChild(figure);

        // Чередование base/overlay — overlay после base, чтобы z-order был стабилен.
        for (var i = 0; i < PARTS.length; i++) {
            var p = PARTS[i];
            figure.appendChild(makeBox(texUrl, texW, texH, U, UV_BASE[p.name], p.w, p.h, p.d, p.cx, p.cy, 0));
            if (isModern) {
                figure.appendChild(makeBox(texUrl, texW, texH, U, UV_OVERLAY[p.name], p.w, p.h, p.d, p.cx, p.cy, 1));
            }
        }

        var tag = document.createElement('div');
        tag.id = 'skin-nametag';
        tag.textContent = name;
        tag.style.position = 'absolute';
        tag.style.left = '0';
        tag.style.top = (-18 * U) + 'px';
        tag.style.transform = 'translate(-50%, -100%)';
        tag.style.background = 'rgba(0,0,0,0.85)';
        tag.style.color = '#fff';
        tag.style.padding = '3px 10px';
        tag.style.borderRadius = '4px';
        tag.style.fontSize = '14px';
        tag.style.fontWeight = '600';
        tag.style.whiteSpace = 'nowrap';
        tag.style.pointerEvents = 'none';
        tag.style.display = 'none';
        figure.appendChild(tag);

        wrap.insertBefore(scene, wrap.firstChild);

        var boxCount = figure.childElementCount - 1;
        console.log('[skin3d] U=' + U + ' boxes=' + boxCount + ' isModern=' + isModern +
            ' texUrl.len=' + texUrl.length + ' (ожидается 12 для 64x64, 6 для 64x32)');

        var state = {
            element: figure,
            scene: scene,
            U: U,
            rotation: 0,
            rotationX: 0,
            autoRotate: false,
            apply: function () {
                this.element.style.transform =
                    'rotateX(' + this.rotationX + 'deg) rotateY(' + this.rotation + 'deg)';
            },
            dispose: function () {
                if (this._ro) { try { this._ro.disconnect(); } catch (e) {} this._ro = null; }
                if (this.scene && this.scene.parentNode) this.scene.parentNode.removeChild(this.scene);
            }
        };
        state.apply();
        return state;
    }

    window.SkinViewer3D = { build: build, computeU: computeU };
})();
