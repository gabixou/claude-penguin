// Clip.js — instância renderizável de um "movie" GoPenguin (timelines.json + packs).
// Port enxuto da classe W do cliente web (gp.js): estado por path, playheads com
// actions (stop/play/gotoAndStop/gotoAndPlay/nextFrame/prevFrame/targets),
// colorTransform, máscaras (clipDepth) e draw(ctx, frame) como no original.
// Reutiliza o MovieRoom para carregar packs/SVGs/rasterização vetorial.

import { MovieRoom } from './movie.js';

const IDENT = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
const IDENT_MATRIX = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };

const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const arrMat = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });
const matArr = (m) => [m.a, m.b, m.c, m.d, m.x, m.y];

// Flash colorTransform: mult (0..1) + add (0..255)
const mulColor = (p, c) => ({
    mult: p.mult.map((v, i) => v * c.mult[i]),
    add: p.mult.map((v, i) => v * c.add[i] + p.add[i]),
});
const colorEq = (a, b) =>
    a.mult.every((v, i) => v === b.mult[i]) && a.add.every((v, i) => v === b.add[i]);
const isIdent = (c) => colorEq(c, IDENT);
// mult rgb = 0, alpha mult = 1, add alpha = 0 -> silhueta sólida na cor `add`
const isSolidTint = (c) =>
    c.mult[0] === 0 && c.mult[1] === 0 && c.mult[2] === 0 &&
    c.mult[3] === 1 && c.add[3] === 0;

export class Clip {
    // movie: instância MovieRoom já carregada (packs + timelines)
    constructor(movie) {
        this.m = movie;
        this.state = new Map();      // path -> {frame, playing, color, visible, matrix, ...}
        this.playheads = new Map();  // path -> {timeline, frame, playing, counters, seen}
        this._solidCache = new Map();
    }

    get data() { return this.m.data; }
    get sprites() { return this.m.sprites; }
    get characters() { return this.m.characters; }

    instance() { return new Clip(this.m); }

    // ---------- estado ----------

    set(path, props) {
        const cur = this.state.get(path);
        const merged = { ...cur, ...props };
        const changed = !cur || Object.keys(props).some((k) => {
            const a = cur?.[k], b = props[k];
            if (a === b) return false;
            if (a && b && typeof a === 'object' && typeof b === 'object' && 'mult' in a) {
                return !colorEq(a, b);
            }
            return true;
        });
        if (!changed) return;
        if ('frame' in props && cur?.frame !== props.frame) this.resetPlayback(path);
        this.state.set(path, merged);
    }

    resetPlayback(path) {
        if (path === undefined) { this.playheads.clear(); return; }
        for (const k of this.playheads.keys())
            if (k === path || k.startsWith(path + '.') || k.startsWith(path + '#'))
                this.playheads.delete(k);
    }

    goto(path, frame, playing = false) {
        const ph = this.playheads.get(path);
        const st = this.state.get(path);
        if ((ph?.frame ?? st?.frame) === frame) {
            if (ph) ph.playing = playing;
            this.set(path, { frame, playing });
            return;
        }
        this.resetPlayback(path);
        this.set(path, { frame, playing });
    }

    resolve(tl, frame) {
        const f = typeof frame === 'string' ? (tl.labels?.[frame] ?? 1) : frame;
        const len = tl.frames?.length || 1;
        return Math.max(1, Math.min(len, f));
    }

    // ---------- playheads / actions ----------

    frameOf(path, tl) {
        const st = this.state.get(path);
        const sf = st?.frame;
        if (sf !== undefined && !st?.playing) return this.resolve(tl, sf);
        let ph = this.playheads.get(path);
        if (ph && ph.timeline !== tl) {
            for (const k of this.playheads.keys())
                if (k.startsWith(path + '.') || k.startsWith(path + '#')) this.playheads.delete(k);
            ph = undefined;
        }
        if (!ph) {
            ph = {
                path,
                frame: sf === undefined ? 1 : this.resolve(tl, sf),
                playing: st?.playing ?? (tl.frames?.length || 0) > 1,
                seen: true,
                timeline: tl,
            };
            this.playheads.set(path, ph);
            this._run(tl, ph);
        }
        ph.seen = true;
        return ph.frame;
    }

    _run(tl, ph, depth = 0) {
        if (depth > 16) return;
        const a = tl.actions?.[ph.frame];
        if (a) {
            if (!Array.isArray(a)) {
                if (a.initial) ph.counters = { ...ph.counters, ...a.initial };
                if (a.loop) {
                    const loop = a.loop;
                    const count = ph.counters?.[loop.counter];
                    if (count !== undefined && count < loop.limit) {
                        ph.counters[loop.counter] = count + 1;
                        ph.frame = this.resolve(tl, loop.frame);
                        ph.playing = true;
                    } else {
                        ph.frame = this.resolve(tl, loop.rest);
                        ph.playing = false;
                    }
                }
            }
            let cmds = Array.isArray(a) ? a : (a.commands ?? []);
            // actions {source:"stop();"} do SWF: sem isso os sub-clips de
            // misc (eat/cookie/bath/play dos puffles) IGNORAVAM o stop e
            // dava wrap 145->1 — a animacao reiniciava no meio do ciclo e
            // parecia "interrompida" quando o cuidado acabava. Walk/stand
            // nao tem actions (loop natural) — nao sao afetados.
            // SO stop/play: gotoAnd*/nextFrame em `source` de clothing etc.
            // nunca foram honrados — nao mudar esse comportamento aqui.
            if (!cmds.length && typeof a?.source === 'string' && a.source.trim()) {
                cmds = [...a.source.matchAll(/\b(stop|play)\s*\(\s*\)/g)]
                    .map((m) => [m[1], null]);
            }
            for (const c of cmds) {
                const op = c[0], arg = c[1];
                if (op === 'stop') ph.playing = false;
                else if (op === 'play') ph.playing = true;
                else if (op === 'gotoAndStop' || op === 'gotoAndPlay') {
                    if (arg !== null) {
                        const nf = this.resolve(tl, arg);
                        const pf = ph.frame;
                        ph.frame = nf;
                        ph.playing = op === 'gotoAndPlay';
                        if (ph.frame !== pf) this._run(tl, ph, depth + 1);
                    }
                } else if (op === 'nextFrame' || op === 'prevFrame') {
                    const nf = this.resolve(tl, ph.frame + (op === 'nextFrame' ? 1 : -1));
                    const pf = ph.frame;
                    ph.frame = nf;
                    ph.playing = false;
                    if (ph.frame !== pf) this._run(tl, ph, depth + 1);
                }
            }
            if (!Array.isArray(a)) {
                for (const t of a.targets ?? []) {
                    const [target, method, arg] = t;
                    const rp = this._relativePath(ph.path, target);
                    if ((method === 'gotoAndStop' || method === 'gotoAndPlay') && arg !== null)
                        this.goto(rp, arg, method === 'gotoAndPlay');
                    else if (method === 'stop' || method === 'play') {
                        const f = this.playheads.get(rp)?.frame ?? this.state.get(rp)?.frame ?? 1;
                        this.goto(rp, f, method === 'play');
                    } else if (method === 'nextFrame' || method === 'prevFrame') {
                        this.goto(rp, this.currentFrame(rp) + (method === 'nextFrame' ? 1 : -1));
                    }
                }
            }
        }
    }

    currentFrame(path) {
        const ph = this.playheads.get(path);
        if (ph) return ph.frame;
        const st = this.state.get(path);
        if (st?.frame !== undefined) return st.frame;
        return 1;
    }

    _relativePath(path, target) {
        let s = path;
        for (const part of target.split('.')) {
            if (part === 'this') continue;
            if (part === '_parent') s = /[.#]/.test(s) ? s.replace(/[.#][^.#]+$/, '') : '';
            else s = s ? `${s}.${part}` : part;
        }
        return s;
    }

    pathOf(entry, parent) {
        if (entry.name) return parent ? `${parent}.${entry.name}` : entry.name;
        return `${parent}#${entry.depth}`;
    }

    // Avança playheads marcados como vistos (chamado ~frameRate por segundo).
    // frames>1 = catch-up: avanca N frames numa so chamada sem resetar `seen`
    // no meio — sem isso, render abaixo de 24fps degradava o advance para
    // 1x por tick e a sub-animacao dos puffles nao acompanhava o relogio real
    // do cuidado (o puffle andava no meio do comer/brincar).
    advance(frames = 1) {
        for (let i = 0; i < frames; i++) {
            for (const ph of [...this.playheads.values()]) {
                if (this.playheads.get(ph.path) !== ph || !ph.seen || !ph.playing) continue;
                const tl = ph.timeline;
                ph.frame = ph.frame >= (tl.frames?.length || 1) ? 1 : ph.frame + 1;
                this._run(tl, ph);
            }
        }
        for (const ph of this.playheads.values()) ph.seen = false;
    }

    beginDraw() {
        for (const ph of this.playheads.values()) ph.seen = false;
    }

    // ---------- desenho ----------

    _mainTimeline() {
        if (!this._mtl) {
            const m = this.data.main || {};
            this._mtl = { frames: m.frames ?? [[]], labels: m.labels ?? {}, actions: m.actions ?? {}, sounds: m.sounds ?? [] };
        }
        return this._mtl;
    }

    // Desenha o frame `frame` da timeline principal. scale = supersampling.
    async draw(ctx, frame = 1, scale = 1) {
        this.beginDraw();
        const tl = this._mainTimeline();
        const entries = tl.frames?.[Math.max(0, Math.min(tl.frames.length, frame) - 1)] ?? [];
        await this._drawList(ctx, entries, IDENT_MATRIX, '', IDENT, scale);
    }

    async _drawList(ctx, entries, world, path, color, scale, force = false) {
        let i = 0;
        while (i < entries.length) {
            const e = entries[i];
            if (e.clipDepth !== undefined) {
                const masked = [];
                while (i + 1 < entries.length && entries[i + 1].depth <= e.clipDepth)
                    masked.push(entries[++i]);
                await this._masked(ctx, e, masked, world, path, color, scale, force);
                i++;
                continue;
            }
            const w = matMul(world, arrMat(e.matrix || [1, 0, 0, 1, 0, 0]));
            await this._entry(ctx, e, w, path, color, scale, force);
            i++;
        }
    }

    async _masked(ctx, maskEntry, contentEntries, world, path, color, scale, force = false) {
        const b = this._boundsOf(contentEntries, world, path) || this._boundsOf([maskEntry], world, path);
        if (!b) {
            for (const e of contentEntries) {
                const w = matMul(world, arrMat(e.matrix || [1, 0, 0, 1, 0, 0]));
                await this._entry(ctx, e, w, path, color, scale, force);
            }
            return;
        }
        const pad = 4;
        const x0 = Math.floor(b[0] - pad), y0 = Math.floor(b[1] - pad);
        const wpx = Math.ceil(b[2] - b[0] + pad * 2), hpx = Math.ceil(b[3] - b[1] + pad * 2);
        const cw = Math.max(1, Math.ceil(wpx * scale)), ch = Math.max(1, Math.ceil(hpx * scale));

        const content = document.createElement('canvas');
        content.width = cw; content.height = ch;
        const cctx = content.getContext('2d');
        cctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
        for (const e of contentEntries) {
            const w = matMul(world, arrMat(e.matrix || [1, 0, 0, 1, 0, 0]));
            await this._entry(cctx, e, w, path, color, scale, force);
        }

        const mask = document.createElement('canvas');
        mask.width = cw; mask.height = ch;
        const mctx = mask.getContext('2d');
        mctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
        const mw = matMul(world, arrMat(maskEntry.matrix || [1, 0, 0, 1, 0, 0]));
        await this._entry(mctx, maskEntry, mw, path, IDENT, scale, true);

        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.globalCompositeOperation = 'destination-in';
        cctx.drawImage(mask, 0, 0);
        cctx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.drawImage(content, x0, y0, wpx, hpx);
        ctx.restore();
    }

    _boundsOf(entries, world, path) {
        let b = null;
        for (const e of entries) {
            const eb = this._entryBounds(e, world, path);
            if (!eb) continue;
            b = b ? [Math.min(b[0], eb[0]), Math.min(b[1], eb[1]), Math.max(b[2], eb[2]), Math.max(b[3], eb[3])] : eb;
        }
        return b;
    }

    _entryBounds(e, world, path) {
        const p = this.pathOf(e, path);
        const st = this.state.get(p);
        if (st?.visible === false) return null;
        const w = matMul(world, arrMat(st?.matrix ?? e.matrix ?? [1, 0, 0, 1, 0, 0]));
        const local = this._localBounds(e, p, w);
        return local;
    }

    _localBounds(e, path, world) {
        const sid = String(e.id);
        const sp = this.sprites[sid];
        if (sp) {
            const frame = sp.frames[this.frameOf(path, sp) - 1] ?? [];
            // _boundsOf ja retorna coords de mundo (compõe matrizes) — retornar direto
            return this._boundsOf(frame, world, path);
        }
        const ch = this.characters[sid];
        if (!ch) return null;
        if (ch.kind === 'button' && ch.records) {
            const rec = ch.records.up ?? ch.records.hittest ?? [];
            return this._boundsOf(rec, world, path);
        }
        let local = null;
        if (ch.file) {
            const cw = ch.size?.[0] ?? 0, chh = ch.size?.[1] ?? 0;
            const ox = ch.origin?.[0] ?? 0, oy = ch.origin?.[1] ?? 0;
            local = [-ox, -oy, cw - ox, chh - oy];
        }
        if (!local) return null;
        const pts = [[local[0], local[1]], [local[2], local[1]], [local[0], local[3]], [local[2], local[3]]]
            .map(([x, y]) => [world.a * x + world.c * y + world.x, world.b * x + world.d * y + world.y]);
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }

    async _entry(ctx, e, world, path, parentColor, scale, force = false) {
        const p = this.pathOf(e, path);
        const st = this.state.get(p);
        if (st?.visible === false && !force) return;

        let color = parentColor;
        const ec = st?.color ?? e.color;
        if (ec && !isIdent(ec)) color = mulColor(color, ec);
        if (color.mult[3] === 0 && color.add[3] === 0) return;

        const sid = String(e.id);
        const sp = this.sprites[sid];
        if (sp) {
            const frame = sp.frames[this.frameOf(p, sp) - 1] ?? [];
            const grid = this.m.scalingGrids?.[sid];
            // scale9Grid do Flash (mesmo port do movie.js): margens fora da
            // grade mantem tamanho fixo; so o centro absorve o stretch.
            const local = arrMat(e.matrix || [1, 0, 0, 1, 0, 0]);
            if (grid && local.a > 0 && local.d > 0 && local.b === 0 && local.c === 0) {
                await this._drawNineSlice(ctx, frame, world, p, color, scale, force, grid, local);
                return;
            }
            await this._drawListFrame(ctx, frame, world, p, color, scale, force);
            return;
        }
        const ch = this.characters[sid];
        if (!ch) return;
        if (ch.kind === 'button') {
            const rec = st?.button ? ch.records?.[st.button] : (ch.records?.up ?? []);
            await this._drawListFrame(ctx, rec, world, p, color, scale, force);
            return;
        }
        if (ch.file) await this._drawShape(ctx, ch, world, color, scale);
    }

    // entries de um frame de sprite — delega para _drawList (trata clipDepth)
    async _drawListFrame(ctx, entries, world, path, color, scale, force) {
        await this._drawList(ctx, entries, world, path, color, scale, force);
    }

    // Port do scale9Grid (movie.js _drawNineSlice / gp drawEntry): as
    // margens fora da grade mantem tamanho fixo em device px; so a regiao
    // central absorve o stretch. `world` = matrix ja composta (pai*instancia).
    async _drawNineSlice(ctx, frame, world, path, color, scale, force, grid, local) {
        const p = this._boundsOf(frame, IDENT_MATRIX, path);
        if (!p) {
            await this._drawListFrame(ctx, frame, world, path, color, scale, force);
            return;
        }
        const b = [p[0], grid[0], grid[2], p[2]];
        const v = [p[1], grid[1], grid[3], p[3]];
        const w = Math.min(1, ((p[2] - p[0]) * local.a) / ((grid[0] - p[0]) + (p[2] - grid[2])));
        const S = Math.min(1, ((p[3] - p[1]) * local.d) / ((grid[1] - p[1]) + (p[3] - grid[3])));
        const x = [p[0], p[0] + (grid[0] - p[0]) * w / local.a,
            p[2] - (p[2] - grid[2]) * w / local.a, p[2]];
        const C = [p[1], p[1] + (grid[1] - p[1]) * S / local.d,
            p[3] - (p[3] - grid[3]) * S / local.d, p[3]];
        // Renderiza o frame UMA vez numa canvas offscreen e fatia o bitmap
        // em 9 drawImages — a versao anterior re-renderizava o vetor por
        // fatia com clip fracionario e abria gap de ~1px nas emendas.
        // Fonte de cada fatia = celula da GRADE (b/v) no render nativo
        // (parent = world * inv(local), sem o stretch da instancia);
        // destino = celula x/C sob world. SS = scale (fator device).
        const SS = scale || 1;
        const devRectM = (m, rx, ry, rw, rh) => {
            const pts = [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]
                .map(([px, py]) => [
                    m.a * px + m.c * py + m.x,
                    m.b * px + m.d * py + m.y,
                ]);
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            return [Math.min(...xs), Math.min(...ys),
                Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
        };
        const parent = matMul(world, {
            a: 1 / local.a, b: 0, c: 0, d: 1 / local.d,
            x: -local.x / local.a, y: -local.y / local.d,
        });
        // devRectM retorna [x, y, w, h] — nw/nh sao w/h, nao coords
        const [nx0, ny0, nw, nh] = devRectM(parent, p[0], p[1], p[2] - p[0], p[3] - p[1]);
        // L: supersample extra para a celula central (ver movie.js) —
        // margem vira downscale nitido, centro fica perto da resolucao nativa
        const L = Math.min(3, Math.max(Math.abs(local.a), Math.abs(local.d), 1));
        const SSX = SS * L;
        const fw = Math.max(1, Math.ceil(nw * SSX)), fh = Math.max(1, Math.ceil(nh * SSX));
        const off = document.createElement('canvas');
        off.width = fw; off.height = fh;
        const octx = off.getContext('2d');
        const mOff = {
            a: parent.a * SSX, b: parent.b * SSX, c: parent.c * SSX, d: parent.d * SSX,
            x: (parent.x - nx0) * SSX, y: (parent.y - ny0) * SSX,
        };
        await this._drawListFrame(octx, frame, mOff, path, color, 1, force);
        for (let r = 0; r < 3; r++) {
            for (let cIdx = 0; cIdx < 3; cIdx++) {
                const P = x[cIdx + 1] - x[cIdx], I = C[r + 1] - C[r];
                if (P <= 0 || I <= 0 || b[cIdx + 1] === b[cIdx] || v[r + 1] === v[r]) continue;
                // src: celula da grade (b/v) no render nativo (mOff, px);
                // dst: celula de destino (x/C) sob world (unidades base)
                const s = devRectM(mOff, b[cIdx], v[r], b[cIdx + 1] - b[cIdx], v[r + 1] - v[r]);
                const d = devRectM(world, x[cIdx], C[r], P, I);
                if (s[2] <= 0 || s[3] <= 0 || d[2] <= 0 || d[3] <= 0) continue;
                ctx.drawImage(off, s[0], s[1], s[2], s[3], d[0], d[1], d[2], d[3]);
            }
        }
    }

    async _drawShape(ctx, ch, world, color, scale) {
        // Escala efetiva: o canvas e rasterizado em `scale` px por unidade de
        // mundo, mas a matriz `world` pode ampliar o shape (ex.: poses de
        // throw/dance usam scale 2-4x). Rasterizar em scale*|world| evita
        // que o bitmap seja esticado e fique pixelado.
        const k = Math.max(Math.hypot(world.a, world.b), Math.hypot(world.c, world.d), 1e-6);
        // quantiza: sem isso floats como 3.6749999999999998 geram chaves de
        // cache distintas a cada frame -> re-rasterizacao continua (lag)
        const eff = +(scale * Math.min(k, 8)).toFixed(3);
        let canvas;
        if (isSolidTint(color)) canvas = await this._solidCanvas(ch, color, eff);
        else if (!isIdent(color)) canvas = await this._pixelTint(ch, color, eff);
        else canvas = await this.m.artCanvas(ch.file, ch, eff);
        if (!canvas) return;
        const w = ch.size?.[0] ?? canvas.width / eff;
        const h = ch.size?.[1] ?? canvas.height / eff;
        const ox = ch.origin?.[0] ?? 0;
        const oy = ch.origin?.[1] ?? 0;
        ctx.save();
        ctx.transform(world.a, world.b, world.c, world.d, world.x, world.y);
        ctx.drawImage(canvas, -ox, -oy, w, h);
        ctx.restore();
    }

    // cor sólida exata: silhueta na cor `add` preservando alpha (caso ve() do pinguim)
    async _solidCanvas(ch, color, scale) {
        const rgb = color.add.slice(0, 3).map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(',');
        const key = `${ch.file}|${rgb}|${scale}`;
        let c = this._solidCache.get(key);
        if (c && c._scale === scale) return c;
        const base = await this.m.artCanvas(ch.file, ch, scale);
        if (!base) return null;
        c = document.createElement('canvas');
        c.width = base.width; c.height = base.height; c._scale = scale;
        const ctx = c.getContext('2d');
        ctx.drawImage(base, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.fillRect(0, 0, c.width, c.height);
        this._solidCache.set(key, c);
        return c;
    }

    // colorTransform geral por pixel — delegado ao movie.tintedCanvas:
    // tint roda em worker pool com cache compartilhado entre todas as
    // instancias (antes: getImageData na main thread + cache por Clip,
    // o que duplicava bitmaps entre pinguins)
    _pixelTint(ch, color, scale) {
        return this.m.tintedCanvas(ch.file, ch, color, scale);
    }
}
