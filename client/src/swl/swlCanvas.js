// Renderer Canvas2D para cenas SWL — equivalente ao swl_gpu_draw/emit do gopenguin.
// Cada frame: consome a lista de draws do SwlScene e desenha no canvas offscreen.
import { DRAW, MASK_BEGIN, MASK_READY, MASK_END, COLOR_BEGIN, COLOR_END } from './swl.js';

const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const colorMul = (p, c) => ({
    mult: p.mult.map((v, i) => v * c.mult[i]),
    add: p.mult.map((v, i) => v * c.add[i] + p.add[i]),
});
const colorIdentity = (c) => c.mult.every((v) => v === 1) && c.add.every((v) => v === 0);
const IDENT = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

export class SwlCanvasRenderer {
    constructor(width, height, atlases) {
        // atlases: array de CanvasImageSource (um por pagina)
        this.canvas = document.createElement('canvas');
        this.canvas.width = width; this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.atlases = atlases;
        this._tintCache = new Map();
        this._tmp = document.createElement('canvas');
        this._tmpCtx = this._tmp.getContext('2d');
    }

    // retorna canvas com o frame atual renderizado
    // start/end: fatia opcional de scene.s.draw (segmentacao por ROOT p/ depth sort com atores)
    render(scene, view = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, start = 0, end = -1) {
        const ctx = this.ctx, s = scene.s;
        if (!scene.prepare()) return this.canvas;
        const drawEnd = end < 0 ? s.draw.length : Math.min(end, s.draw.length);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const maskStack = [];   // {path:Path2D}
        const colorStack = [IDENT];
        let painting = null;    // Path2D sendo acumulado p/ clip

        for (let di = start; di < drawEnd; di++) {
            const d = s.draw[di];
            if (d.type === MASK_BEGIN) {
                maskStack.push({ path: new Path2D(), saved: false });
                painting = maskStack[maskStack.length - 1].path;
                continue;
            }
            if (d.type === MASK_READY) {
                painting = null;
                const m = maskStack[maskStack.length - 1];
                if (m) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clip(m.path); m.saved = true; }
                continue;
            }
            if (d.type === MASK_END) {
                const m = maskStack.pop();
                painting = null;
                if (m && m.saved) ctx.restore();
                continue;
            }
            if (d.type === COLOR_BEGIN) { colorStack.push(colorMul(colorStack[colorStack.length - 1], d.color)); continue; }
            if (d.type === COLOR_END) { if (colorStack.length > 1) colorStack.pop(); continue; }
            if (d.type !== DRAW || (d.art & 0x80000000)) continue;

            const art = scene.artIndex(d.art);
            if (!art) continue;
            const m = matMul(view, d.matrix);

            // dentro da fase de mascara: acumula o quad no path de clip
            if (painting) { this._maskQuad(painting, art, m); continue; }

            const color = colorMul(colorStack[colorStack.length - 1], d.color);
            const src = this._sourceFor(art, color);
            if (!src) continue;

            const alpha = Math.max(0, Math.min(1, color.mult[3] + color.add[3]));
            ctx.setTransform(m.a, m.b, m.c, m.d, m.x, m.y);
            ctx.globalAlpha = alpha;
            ctx.drawImage(src.src, src.sx, src.sy, src.sw, src.sh, art.left, art.top, art.width, art.height);
        }
        // restaura clips pendentes (cenarios sem MASK_END balanceado)
        while (maskStack.length) { const m = maskStack.pop(); if (m.saved) ctx.restore(); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        return this.canvas;
    }

    // desenha o quad do art no path de mascara (coords de tela)
    _maskQuad(path, art, m) {
        const pts = [];
        for (const [lx, ly] of [[art.left, art.top], [art.left + art.width, art.top], [art.left + art.width, art.top + art.height], [art.left, art.top + art.height]]) {
            pts.push([m.a * lx + m.c * ly + m.x, m.b * lx + m.d * ly + m.y]);
        }
        path.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) path.lineTo(pts[i][0], pts[i][1]);
        path.closePath();
    }

    // fonte de imagem para o art: atlas direto ou versao tintada em cache
    _sourceFor(art, color) {
        const atlas = this.atlases[art.page];
        if (!atlas) return null;
        const ident = colorIdentity(color);
        if (ident) return { src: atlas, sx: art.x, sy: art.y, sw: art.w, sh: art.h, tinted: null };
        const key = art.page + ':' + art.x + ',' + art.y + ',' + art.w + ',' + art.h + '|' +
            color.mult.map((v) => v.toFixed(3)).join(',') + '|' + color.add.map((v) => v.toFixed(3)).join(',');
        let c = this._tintCache.get(key);
        if (!c) {
            c = document.createElement('canvas');
            c.width = art.w; c.height = art.h;
            const g = c.getContext('2d');
            g.drawImage(atlas, art.x, art.y, art.w, art.h, 0, 0, art.w, art.h);
            // multiply
            g.globalCompositeOperation = 'multiply';
            g.fillStyle = `rgb(${Math.round(color.mult[0] * 255)},${Math.round(color.mult[1] * 255)},${Math.round(color.mult[2] * 255)})`;
            g.fillRect(0, 0, art.w, art.h);
            // add
            g.globalCompositeOperation = 'lighter';
            g.fillStyle = `rgba(${Math.round(color.add[0] * 255)},${Math.round(color.add[1] * 255)},${Math.round(color.add[2] * 255)},${Math.min(1, color.add[3])})`;
            g.fillRect(0, 0, art.w, art.h);
            g.globalCompositeOperation = 'source-over';
            this._tintCache.set(key, c);
            if (this._tintCache.size > 400) this._tintCache.delete(this._tintCache.keys().next().value);
        }
        return { src: c, sx: 0, sy: 0, sw: art.w, sh: art.h, tinted: true };
    }

    // sobrecarga drawImage unificada
    drawArt(img, art) { /* nao usado - mantido p/ clareza */ }
}
