// Port fiel de E:\project\gopenguin-3ds-main\source\swl.c para JS puro.
// Formato SWL2: cabecalho 64B + 8 tabelas (ART,TL,FRAME,ENTRY,CMD,LABEL,STATE,STRING).
// Expõe: loadSwl(buffer) -> scene; scene.prepare()/tick()/render(draws)/bounds().

const STRIDES_V1 = [40, 12, 16, 76, 12, 12, 16, 1];
const STRIDES_V2 = [40, 12, 16, 80, 32, 12, 16, 1]; // ART,TL,FRAME,ENTRY,CMD,LABEL,STATE,STRING
const CAPS = [8192, 8192, 65536, 131072, 65536, 16384, 1024, 1024 * 1024];
const ART = 0, TL = 1, FRAME = 2, ENTRY = 3, CMD = 4, LABEL = 5, STATE = 6, STRING = 7;
export const DRAW = 0, ROOT = 1, MASK_BEGIN = 2, MASK_READY = 3, MASK_END = 4, COLOR_BEGIN = 5, COLOR_END = 6;
const MAX_DEPTH = 24, MAX_MASKS = 8, MAX_DRAWS = 4096;

const IDENTITY_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
const IDENTITY_MATRIX = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };

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

export function loadSwl(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const u32 = (o) => dv.getUint32(o, true);
    const f32 = (o) => dv.getFloat32(o, true);
    if (buf.length < 64) throw new Error('Invalid scene size');
    const version = u32(4);
    const magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    if ((version !== 1 && version !== 2) || magic !== (version === 1 ? 'SWL1' : 'SWL2') || u32(8) !== buf.length)
        throw new Error('Invalid scene header');

    const s = {
        version, width: f32(12), height: f32(16), rate: f32(20),
        root: u32(24), pages: u32(28),
        count: [], table: [], stride: version === 1 ? STRIDES_V1.slice() : STRIDES_V2.slice(),
        error: null, dirty: true, building: false,
        heads: new Map(), overrides: new Map(),
        draw: [], old: [], drawCount: 0, oldCount: 0,
        used: 0, overrides_n: 0,
        instanceCount: 0, hitCount: 0, glyphCount: 0,
        maskDepth: 0, colorDepth: 0, actionDepth: 0,
        stats: { draws: 0, masks: 0, colorGroups: 0, preparations: 0 },
        player: null, hasPlayer: false,
        viewPath: '', viewFrame: 0,
    };
    if (s.version === 2 && (s.pages & 0x80000000)) s.bits = 16; else s.bits = 32;
    s.pages &= 0x7fffffff;

    let off = 64;
    for (let t = 0; t < 8; t++) {
        s.count[t] = u32(32 + t * 4);
        if (s.count[t] > CAPS[t] || s.count[t] > (buf.length - off) / s.stride[t]) throw new Error('Table exceeds budget');
        s.table[t] = off; off += s.count[t] * s.stride[t];
    }
    if (off !== buf.length) throw new Error('Trailing scene bytes');
    s._dv = dv; s._buf = buf;
    s._u32 = (t, n, f) => u32(s.table[t] + n * s.stride[t] + f);
    s._f32 = (t, n, f) => f32(s.table[t] + n * s.stride[t] + f);
    s._row = (t, n) => s.table[t] + n * s.stride[t];
    s._str = (n) => {
        const base = s.table[STRING]; let e = base + n;
        while (e < buf.length && buf[e] !== 0) e++;
        let out = '';
        for (let i = base + n; i < e; i++) out += String.fromCharCode(buf[i]);
        return out;
    };
    return s;
}

// ---------- helpers ----------
function range(first, count, total) { return first <= total && count <= total - first; }

export class SwlScene {
    constructor(s) { this.s = s; }

    _symbol(t, id) {
        const s = this.s; let lo = 0, hi = s.count[t];
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const n = s._u32(t, mid, 0);
            if (n === id) return s._row(t, mid);
            if (n < id) lo = mid + 1; else hi = mid;
        }
        return null;
    }
    _stringValid(n) { return n < this.s.count[STRING]; }
    _strAt(n) { return this.s._str(n); }

    _hashPath(p) { let h = 2166136261 >>> 0; for (let i = 0; i < p.length; i++) { h ^= p.charCodeAt(i) & 255; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
    _instHash(p) { // FNV-1a 64 -> BigInt
        let h = 14695981039346656037n;
        for (let i = 0; i < p.length; i++) { h ^= BigInt(p.charCodeAt(i) & 255); h = (h * 1099511628211n) & 0xFFFFFFFFFFFFFFFFn; }
        return h;
    }

    _clampTL(tlIdx, n) {
        const max = this.s._u32(TL, tlIdx, 8);
        return n < 1 ? 1 : n > max ? max : n;
    }
    _tlRow(id) { const r = this._symbol(TL, id); return r === null ? null : (r - this.s.table[TL]) / this.s.stride[TL]; }
    // resolve(s,id,frame,label) do C: 0 = falha
    _resolve(id, frame, label) {
        const s = this.s;
        if (label) {
            for (let i = 0; i < s.count[LABEL]; i++) {
                const r = s._row(LABEL, i);
                if (s._u32(LABEL, i, 0) === id && this._strAt(s._u32(LABEL, i, 4)) === label) return s._u32(LABEL, i, 8);
            }
            return 0;
        }
        const tlIdx = this._tlRow(id);
        return tlIdx === null ? 0 : this._clampTL(tlIdx, frame);
    }

    _override(path, create) {
        const s = this.s;
        if (s.overrides.has(path)) return s.overrides.get(path);
        if (!create) return null;
        if (path.length >= 256 || s.overrides_n >= 768) { s.error = 'Instance override budget exceeded'; return null; }
        const o = { path, label: '', frame: 0, hasFrame: false, playing: false, hasVisible: false, visible: true, hasColor: false, color: null, hasMatrix: false, matrix: null };
        s.overrides.set(path, o); s.overrides_n++;
        return o;
    }

    _resetChildren(path) {
        const s = this.s; let changed = false;
        for (const [p, h] of s.heads) {
            if (!h.active) continue;
            const hit = (path.length === 0 && p.length > 0) || (p.startsWith(path) && (p[path.length] === '.' || p[path.length] === '#'));
            if (hit) { h.active = false; changed = true; s.heads.delete(p); }
        }
        return changed;
    }

    _relativePath(from, target) {
        const s = this.s;
        if (from.length >= 256) { s.error = 'Instance path too long'; return null; }
        let out = from;
        const parts = target.split('.');
        for (const part of parts) {
            if (part === 'this') { /* noop */ }
            else if (part === '_parent') {
                const last = Math.max(out.lastIndexOf('.'), out.lastIndexOf('#'));
                out = last >= 0 ? out.slice(0, last) : '';
            } else {
                if (out.length + part.length + 2 > 256) { s.error = 'Target path too long'; return null; }
                out = out ? out + '.' + part : part;
            }
        }
        return out;
    }

    _gotoInternal(path, frame, label, playing, require) {
        const s = this.s;
        let h = s.heads.get(path);
        if (require && !h) return false;
        if (label && label.length >= 64) { s.error = 'Frame label too long'; return false; }
        const resolved = h ? this._resolveHead(h, frame, label) : frame;
        if (h && !resolved) return false;
        const o = this._override(path, true); if (!o) return false;
        o.hasFrame = true; o.frame = frame; o.playing = playing; o.label = label || '';
        if (h) {
            const changed = h.frame !== resolved;
            if (changed) { this._resetChildren(path); h.names.fill(0); h.values.fill(0); }
            h.frame = resolved; h.playing = playing;
            if (changed && !this._run(h)) return false;
        }
        s.dirty = true; return true;
    }
    _resolveHead(h, frame, label) {
        // resolve por symbol do head
        if (label) {
            const s = this.s;
            for (let i = 0; i < s.count[LABEL]; i++) {
                const r = s._row(LABEL, i);
                if (s._u32(LABEL, i, 0) === h.symbol && this._strAt(s._u32(LABEL, i, 4)) === label) return s._u32(LABEL, i, 8);
            }
            return 0;
        }
        const tlIdx = this._tlRow(h.symbol);
        if (tlIdx === null) return frame;
        const max = this.s._u32(TL, tlIdx, 8); return frame < 1 ? 1 : frame > max ? max : frame;
    }

    _run(h) {
        const s = this.s;
        if (++s.actionDepth > 32) { s.actionDepth--; s.error = 'Timeline action recursion exceeds budget'; return false; }
        const tlIdx = this._tlRow(h.symbol);
        const f0 = s._u32(TL, tlIdx, 4);
        const frameRow = s._row(FRAME, f0 + h.frame - 1);
        const cmdCount = s._u32(FRAME, f0 + h.frame - 1, 12);
        const cmdFirst = s._u32(FRAME, f0 + h.frame - 1, 8);
        for (let i = 0; i < cmdCount && !s.error; i++) {
            const c = s._row(CMD, cmdFirst + i); // offset absoluto no arquivo
            const op = s._dv.getUint32(c, true), arg = s._dv.getUint32(c + 4, true);
            let a = arg, previous = h.frame;
            const cflags = s.version === 2 ? s._dv.getUint32(c + 24, true) : 0;
            if (s.version === 2 && (cflags & 2)) {
                h.random ^= (h.random << 13) >>> 0; h.random ^= h.random >>> 17; h.random ^= (h.random << 5) >>> 0; h.random >>>= 0;
                const first = s._dv.getUint32(c + 8, true);
                a = (first ? first : 1) + (h.random % arg);
            }
            if (s.version === 2 && (cflags & 4)) {
                const path = this._relativePath(h.path, this._strAt(a));
                if (path === null) break;
                const other = s.heads.get(path);
                a = other ? other.frame : 1;
                if (!other) {
                    for (let k = 0; k < s.count[STATE]; k++) {
                        const r = s._row(STATE, k);
                        if (this._strAt(s._u32(STATE, k, 0)) === path && (s._u32(STATE, k, 8) & 2)) { a = s._u32(STATE, k, 4); break; }
                    }
                }
            }
            const target = s.version === 2 ? this._strAt(s._dv.getUint32(c + 16, true)) : '';
            const label = s.version === 2 && (cflags & 1) ? this._strAt(a) : null;
            if (op === 10) continue; // som
            if (op === 7 || op === 8) {
                const name = s._dv.getUint32(c + 20, true);
                let slot = -1;
                for (let k = 0; k < 8; k++) { if (h.names[k] === name || h.names[k] === 0) { slot = k; break; } }
                if (slot < 0) { s.error = 'Counter budget exceeded'; break; }
                if (op === 7) { h.names[slot] = name; h.values[slot] = a; }
                else {
                    const again = h.names[slot] && h.values[slot] < a;
                    if (again) h.values[slot]++;
                    const nf = s._dv.getUint32(c + (again ? 8 : 12), true);
                    h.frame = this._clampTL(tlIdx, nf);
                    h.playing = again;
                }
                continue;
            }
            if (target) {
                const path = this._relativePath(h.path, target); if (path === null) break;
                const other = s.heads.get(path);
                let next = a;
                if (op === 1 || op === 2) next = other ? other.frame : 1;
                if (op === 5 || op === 6) next = other ? other.frame + (op === 5 ? 1 : other.frame > 1 ? -1 : 0) : 1;
                if (!this._gotoInternal(path, next, label, op === 2 || op === 4, false)) break;
                continue;
            }
            if (op === 1) h.playing = false;
            else if (op === 2) h.playing = true;
            else if (op === 3 || op === 4) {
                const next = this._resolveHead(h, a, label);
                if (!next) { s.error = 'Unknown frame label'; break; }
                h.frame = next; h.playing = op === 4;
            } else if (op === 5 || op === 6) {
                const max = s._u32(TL, tlIdx, 8);
                h.frame = op === 5 ? Math.min(h.frame + 1, max) : (h.frame > 1 ? h.frame - 1 : 1);
                h.playing = false;
            }
            if (h.frame !== previous && !this._run(h)) break;
        }
        s.actionDepth--; return !s.error;
    }

    _getHead(path, id) {
        const s = this.s;
        let h = s.heads.get(path);
        if (h && h.symbol === id) { h.seen = true; return h; }
        if (h) { s.heads.delete(path); this._resetChildren(path); h = null; }
        h = {
            path, hash: this._hashPath(path), symbol: id, frame: 1,
            random: (this._hashPath(path) ^ 0xa341316c) >>> 0,
            names: new Array(8).fill(0), values: new Array(8).fill(0),
            playing: false, seen: true, active: true,
        };
        const tlIdx = this._tlRow(id);
        h.playing = tlIdx !== null && s._u32(TL, tlIdx, 8) > 1;
        s.heads.set(path, h); s.used++;
        for (let i = 0; i < s.count[STATE]; i++) {
            const r = s._row(STATE, i);
            if (this._strAt(s._u32(STATE, i, 0)) !== path) continue;
            const flags = s._u32(STATE, i, 8);
            if (flags & 2) { h.frame = this._clampTL(tlIdx, s._u32(STATE, i, 4)); h.playing = !!(flags & 4); }
        }
        const o = this._override(path, false);
        if (o && o.hasFrame) {
            const frame = this._resolve(id, o.frame, o.label || null);
            if (!frame) { s.error = 'Unknown target label'; return null; }
            h.frame = frame; h.playing = o.playing;
        }
        if (!this._run(h)) return null;
        return h;
    }

    _hidden(path) {
        const s = this.s;
        const o = this._override(path, false);
        if (o && o.hasVisible) return !o.visible;
        for (let i = 0; i < s.count[STATE]; i++) {
            const r = s._row(STATE, i);
            if ((s._u32(STATE, i, 8) & 1) && this._strAt(s._u32(STATE, i, 0)) === path) return true;
        }
        return false;
    }

    _append(type, layer, depth, matrix, color, art, token) {
        const s = this.s;
        if (s.draw.length >= MAX_DRAWS) { s.error = 'Draw command budget exceeded'; return false; }
        s.draw.push({ type, layer, depth, matrix, color, art, token, previous: -1 });
        return true;
    }

    _walk(id, path, matrix, color, depth, layer, renderDepth, masking) {
        const s = this.s;
        if (depth > MAX_DEPTH) { s.error = 'Timeline nesting exceeds budget'; return false; }
        const t = this._symbol(TL, id);
        if (!t) {
            const r = this._symbol(ART, id);
            if (!r) { s.error = 'Missing art'; return false; }
            const idx = (r - s.table[ART]) / s.stride[ART];
            return this._append(DRAW, layer, renderDepth, matrix, color, idx, this._hashPath(path));
        }
        const tlIdx = (t - s.table[TL]) / s.stride[TL];
        const frameCount = s._u32(TL, tlIdx, 8), cmdFirst = s._u32(TL, tlIdx, 4);
        let h = null;
        if (frameCount > 1 || s._u32(FRAME, cmdFirst, 12)) h = this._getHead(path, id);
        if (frameCount > 1 || s._u32(FRAME, cmdFirst, 12)) { if (!h) return false; }
        let frame = h ? h.frame : 1;
        if (s.viewFrame && path === s.viewPath) {
            if (s.viewFrame > frameCount) { s.error = 'Display frame outside timeline'; return false; }
            frame = s.viewFrame;
        }
        const group = !colorIdentity(color) && !masking;
        const begin = s.draw.length;
        if (group) {
            if (++s.colorDepth > 8) { s.error = 'Color nesting exceeds budget'; return false; }
            if (!this._append(COLOR_BEGIN, layer, renderDepth, matrix, color, 0, 0)) return false;
        }
        const fIdx = s._u32(TL, tlIdx, 4) + frame - 1;
        const entFirst = s._u32(FRAME, fIdx, 0), entCount = s._u32(FRAME, fIdx, 4);
        if (!this._list(entFirst, entCount, path, matrix, depth, layer, renderDepth, masking)) return false;
        if (group) {
            if (s.draw.length === begin + 2 && s.draw[begin + 1].type === DRAW) {
                const d = { ...s.draw[begin + 1], color: colorMul(color, s.draw[begin + 1].color) };
                s.draw[begin] = d; s.draw.pop();
            } else if (!this._append(COLOR_END, layer, renderDepth, matrix, color, 0, 0)) return false;
            s.colorDepth--;
        }
        return true;
    }

    _entry(r, parent, matrix, depth, layer, renderDepth, force, masking) {
        const s = this.s;
        const off = r; // offset absoluto no arquivo
        const sym = s._dv.getUint32(off, true), nameN = s._dv.getUint32(off + 8, true), flags = s._dv.getUint32(off + 12, true);
        const name = this._strAt(nameN);
        let path;
        if (name) {
            path = parent ? parent + '.' + name : name;
            if (path.length >= 256) { s.error = 'Instance path exceeds budget'; return false; }
        } else {
            const d = s._dv.getUint32(off + 4, true);
            path = parent + '#' + d;
            if (path.length >= 256) { s.error = 'Instance path exceeds budget'; return false; }
        }
        if (!force && this._hidden(path)) return true;
        const mo = s.version === 2 ? 24 : 20;
        const local = {
            a: s._dv.getFloat32(off + mo, true), b: s._dv.getFloat32(off + mo + 4, true),
            c: s._dv.getFloat32(off + mo + 8, true), d: s._dv.getFloat32(off + mo + 12, true),
            x: s._dv.getFloat32(off + mo + 16, true), y: s._dv.getFloat32(off + mo + 20, true),
        };
        let color = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
        if (!masking) {
            color = {
                mult: [0, 1, 2, 3].map((i) => s._dv.getFloat32(off + mo + 24 + i * 4, true)),
                add: [0, 1, 2, 3].map((i) => s._dv.getFloat32(off + mo + 40 + i * 4, true)),
            };
            // sentinel player-tint setRGB(0x01FE03)
            if (color.mult[0] === 0 && color.mult[1] === 0 && color.mult[2] === 0 && color.add[0] === 1 && color.add[1] === 254 && color.add[2] === 3) {
                if (s.hasPlayer) color.add = s.player.slice();
                else color.add = [0, 0x33 / 255, 0x66 / 255, color.add[3]];
            }
        }
        const o = this._override(path, false);
        if (o) { if (o.hasMatrix) local && Object.assign(local, o.matrix); if (o.hasColor && !masking) color = o.color; }
        // alpha zero -> invisivel
        if (color.mult[3] === 0 && color.add[3] === 0) return true;
        const world = matMul(matrix, local);
        if ((flags & 2) && !masking) {
            if (s.hitCount >= 256) { s.error = 'Interactive entry budget exceeded'; return false; }
            s.hits = s.hits || []; s.hits.push({ id: s._dv.getUint32(off + 16, true), matrix: world, path }); s.hitCount++;
        }
        return this._walk(sym, path, world, color, depth + 1, layer, renderDepth, masking);
    }

    _list(first, count, path, matrix, depth, layer, renderDepth, masking) {
        const s = this.s;
        for (let i = 0; i < count; i++) {
            const r = s._row(ENTRY, first + i);
            const off = r; // offset absoluto no arquivo
            let localLayer = layer, z = renderDepth;
            if (depth === 0) {
                const ename = this._strAt(s._dv.getUint32(off + 8, true));
                localLayer = ename === 'foreground_mc' ? 1 : 0;
                z = s.version === 2 ? s._dv.getFloat32(off + 20, true) : (localLayer ? 900001 : s._dv.getUint32(off + 4, true));
                if (!this._append(ROOT, localLayer, z, matrix, { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] }, 0, 0)) return false;
            }
            if (s._dv.getUint32(off + 12, true) & 1) {
                if (++s.maskDepth > MAX_MASKS) { s.error = 'Mask nesting exceeds budget'; return false; }
                if (!this._append(MASK_BEGIN, localLayer, z, matrix, IDENTITY_COLOR, 0, 0)) return false;
                if (!this._entry(r, path, matrix, depth, localLayer, z, true, true)) return false;
                if (!this._append(MASK_READY, localLayer, z, matrix, IDENTITY_COLOR, 0, 0)) return false;
                const start = i + 1;
                const maskDepthLimit = s._dv.getUint32(off + 16, true);
                while (i + 1 < count && s._dv.getUint32(s.table[ENTRY] + (first + i + 1) * s.stride[ENTRY] + 4, true) <= maskDepthLimit) i++;
                if (!this._list(first + start, i - start + 1, path, matrix, depth + 1, localLayer, z, masking)) return false;
                if (!this._append(MASK_END, localLayer, z, matrix, IDENTITY_COLOR, 0, 0)) return false;
                s.maskDepth--;
            } else if (!this._entry(r, path, matrix, depth, localLayer, z, false, masking)) return false;
        }
        return true;
    }

    _prepare() {
        const s = this.s;
        if (s.building) return true;
        s.building = true;
        // swap como no C: old recebe os draws do frame anterior, draw reinicia
        const tmp = s.old; s.old = s.draw; s.draw = tmp;
        s.oldCount = s.old.length;
        s.stats.draws = s.stats.masks = s.stats.colorGroups = 0;
        s.maskDepth = s.colorDepth = 0;
        let ok = false;
        for (let pass = 0; pass < 32; pass++) {
            s.dirty = false; s.draw.length = 0;
            s.stats.draws = s.stats.masks = s.stats.colorGroups = 0;
            s.maskDepth = s.colorDepth = 0; s.instanceCount = s.hitCount = s.glyphCount = 0;
            s.hits = [];
            for (const h of s.heads.values()) h.seen = false;
            ok = this._walk(s.root, '', { ...IDENTITY_MATRIX }, { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] }, 0, 0, 0, false);
            if (!ok || !s.dirty) break;
            if (pass === 31) { s.error = 'Timeline targets did not settle'; ok = false; }
        }
        s.stats.preparations++; s.building = false; s.dirty = false;
        // marca 'previous' para interpolacao: casa draw atual com old por token+art
        for (let i = 0; i < s.draw.length; i++) {
            const d = s.draw[i];
            if (d.type !== DRAW) continue;
            for (let j = s.old.length - 1; j >= 0; j--) {
                const o = s.old[j];
                if (o.type === DRAW && o.token === d.token && o.art === d.art) { d.previous = j; break; }
            }
        }
        return ok;
    }

    prepare() { return !this.s.dirty || this._prepare(); }
    tick() {
        const s = this.s;
        if (s.dirty && !this.prepare()) return false;
        const heads = [...s.heads.values()];
        let changed = false;
        for (const h of heads) {
            if (!h.active || !h.seen || !h.playing) continue;
            changed = true;
            const tlIdx = this._tlRow(h.symbol);
            const max = s._u32(TL, tlIdx, 8);
            h.frame = h.frame >= max ? 1 : h.frame + 1;
            if (!this._run(h)) return false;
        }
        if (!changed) return !s.error;
        s.dirty = true; return !s.error && this.prepare();
    }

    goto(path, frame, label, playing) { return this._gotoInternal(path, frame, label, playing, true); }
    target(path, frame, label, playing) { return this._gotoInternal(path, frame, label, playing, false); }
    frame(path) {
        const s = this.s, h = s.heads.get(path);
        if (h) return h.frame;
        const o = s.overrides.get(path);
        if (o && o.hasFrame) return o.frame;
        for (let i = 0; i < s.count[STATE]; i++) {
            const r = s._row(STATE, i);
            if ((s._u32(STATE, i, 8) & 2) && this._strAt(s._u32(STATE, i, 0)) === path) return s._u32(STATE, i, 4);
        }
        return 0;
    }
    visible(path, v) { const o = this._override(path, true); if (!o) return false; if (o.hasVisible !== true || o.visible !== v) { o.hasVisible = true; o.visible = v; this.s.dirty = true; } return true; }
    playerColor(rgb) {
        const s = this.s;
        const c = [(rgb >> 16 & 255) / 255, (rgb >> 8 & 255) / 255, (rgb & 255) / 255];
        if (s.hasPlayer && s.player[0] === c[0] && s.player[1] === c[1] && s.player[2] === c[2]) return;
        s.player = c; s.hasPlayer = true; s.dirty = true;
    }
    // art por INDICE de linha (o que os draws carregam) — row(s,ART,d->art) no C
    artIndex(i) {
        const s = this.s, o = s.table[ART] + i * s.stride[ART];
        return {
            id: s._dv.getUint32(o, true), page: s._dv.getUint32(o + 4, true),
            x: s._dv.getUint32(o + 8, true), y: s._dv.getUint32(o + 12, true),
            w: s._dv.getUint32(o + 16, true), h: s._dv.getUint32(o + 20, true),
            left: s._dv.getFloat32(o + 24, true), top: s._dv.getFloat32(o + 28, true),
            width: s._dv.getFloat32(o + 32, true), height: s._dv.getFloat32(o + 36, true),
        };
    }
    art(id) {
        const s = this.s, r = this._symbol(ART, id);
        if (!r) return null;
        const o = r; // offset absoluto
        return {
            id: s._dv.getUint32(o, true), page: s._dv.getUint32(o + 4, true),
            x: s._dv.getUint32(o + 8, true), y: s._dv.getUint32(o + 12, true),
            w: s._dv.getUint32(o + 16, true), h: s._dv.getUint32(o + 20, true),
            left: s._dv.getFloat32(o + 24, true), top: s._dv.getFloat32(o + 28, true),
            width: s._dv.getFloat32(o + 32, true), height: s._dv.getFloat32(o + 36, true),
        };
    }
    bounds() {
        if (!this.prepare()) return null;
        let b = null;
        const masks = [];
        for (const d of this.s.draw) {
            if (d.type === MASK_BEGIN) masks.push(true);
            else if (d.type === MASK_END) masks.pop();
            else if (d.type !== DRAW || masks.length) continue;
            const a = this.artIndex(d.art);
            if (!a) continue;
            for (let i = 0; i < 4; i++) {
                const lx = a.left + (i & 1 ? a.width : 0), ly = a.top + (i & 2 ? a.height : 0);
                const px = d.matrix.a * lx + d.matrix.c * ly + d.matrix.x;
                const py = d.matrix.b * lx + d.matrix.d * ly + d.matrix.y;
                if (!b) b = [px, py, px, py];
                else { b[0] = Math.min(b[0], px); b[1] = Math.min(b[1], py); b[2] = Math.max(b[2], px); b[3] = Math.max(b[3], py); }
            }
        }
        return b;
    }
}
