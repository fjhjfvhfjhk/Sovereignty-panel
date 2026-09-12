/* skin3d.js — CSS 3D Minecraft skin viewer (без зависимостей) */
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

    function makeFace(texUrl, texW, texH, U, uv, fw, fh, transform) {
        var d = document.createElement('div');
        d.style.cssText = 'position:absolute;left:0;top:0;width:' + (fw*U) + 'px;height:' + (fh*U) + 'px;' +
            'background-image:url(' + texUrl + ');background-size:' + texW + 'px ' + texH + 'px;' +
            'background-position:' + (-uv[0]*U) + 'px ' + (-uv[1]*U) + 'px;background-repeat:no-repeat;' +
            'image-rendering:pixelated;image-rendering:crisp-edges;' +
            'transform:translate(-50%,-50%) ' + transform + ';transform-origin:center;backface-visibility:hidden';
        return d;
    }

    function makeBox(texUrl, texW, texH, U, uv, w, h, d, cx, cy, inflate) {
        inflate = inflate | 0;
        var box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;' +
            'transform-style:preserve-3d;' +
            'transform:translate3d(' + (cx*U) + 'px,' + (-cy*U) + 'px,0)';
        var W = w*U, H = h*U, D = d*U, INF = inflate*U;
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.f,  w, h, 'translateZ(' + (D/2+INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.b,  w, h, 'rotateY(180deg) translateZ(' + (D/2+INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.r,  d, h, 'rotateY(90deg) translateZ(' + (W/2+INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.l,  d, h, 'rotateY(-90deg) translateZ(' + (W/2+INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.t,  w, d, 'rotateX(90deg) translateZ(' + (H/2+INF) + 'px)'));
        box.appendChild(makeFace(texUrl, texW, texH, U, uv.bo, w, d, 'rotateX(-90deg) translateZ(' + (H/2+INF) + 'px)'));
        return box;
    }

    function build(img, name, wrap) {
        var U = computeU(wrap);
        var isModern = img.height >= 64;

        // Пред-рендер текстуры в нативном разрешении — предотвращает билинейное размытие.
        var tc = document.createElement('canvas');
        tc.width = img.width * U;
        tc.height = img.height * U;
        var tctx = tc.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0, tc.width, tc.height);
        var texUrl = 'url("' + tc.toDataURL('image/png') + '")';
        var texW = tc.width, texH = tc.height;

        var scene = document.createElement('div');
        scene.className = 'skin-scene';
        scene.style.cssText = 'position:absolute;inset:0;overflow:hidden;cursor:grab;user-select:none';

        var figure = document.createElement('div');
        figure.className = 'skin-figure';
        var sw = wrap.clientWidth || 380, sh = wrap.clientHeight || 380;
        figure.style.cssText = 'position:absolute;left:' + Math.floor(sw/2) + 'px;top:' + Math.floor(sh/2) + 'px;' +
            'width:0;height:0;transform-style:preserve-3d';
        scene.appendChild(figure);

        // Чередуем base / overlay — overlay после base для стабильного z-order
        for (var i = 0; i < PARTS.length; i++) {
            var p = PARTS[i];
            var uvB = isModern ? UV_BASE[p.name] : UV_BASE[p.name];
            figure.appendChild(makeBox(texUrl, texW, texH, U, uvB, p.w, p.h, p.d, p.cx, p.cy, 0));
            if (isModern) {
                var uvO = UV_OVERLAY[p.name];
                figure.appendChild(makeBox(texUrl, texW, texH, U, uvO, p.w, p.h, p.d, p.cx, p.cy, 1));
            }
        }

        // Legacy 64×32: overlay-слой отсутствует

        var tag = document.createElement('div');
        tag.id = 'skin-nametag';
        tag.textContent = name;
        tag.style.cssText = 'position:absolute;left:0;top:' + (-18*U) + 'px;transform:translate(-50%,-100%);' +
            'background:rgba(0,0,0,0.85);color:#fff;padding:3px 10px;border-radius:4px;font-size:14px;' +
            'font-weight:600;white-space:nowrap;pointer-events:none;display:none';
        figure.appendChild(tag);

        wrap.insertBefore(scene, wrap.firstChild);

        var boxCount = figure.childElementCount - 1;
        console.log('[skin3d] U=' + U + ' boxes=' + boxCount + ' isModern=' + isModern +
            ' (ожидается 12 для 64x64, 6 для 64x32)');

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
