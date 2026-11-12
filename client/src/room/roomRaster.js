// Rasterizacao das salas vetoriais, independente da cena Phaser.
//
// A sala e dividida em SEGMENTOS estaticos (canvas cropado cada) e OVERLAYS
// dinamicos (sprites animados), na ordem de desenho do Flash. O RoomScene
// usa estas funcoes para montar a sala ao vivo, e prerenderRoom() usa as
// MESMAS funcoes para rasterizar salas vizinhas em segundo plano direto no
// cache de layers do IndexedDB — quando o jogador entra, e cache hit e a
// sala aparece quase instantaneamente (design otimista).
import { MovieRoom, IDENT_COLOR } from '../movie/movie.js';

// ---------- Cache de layers (IndexedDB) ----------
// Chave inclui escala (supersampling) e fingerprint do pack para invalidar
// se os assets mudarem.
const LAYER_CACHE = 'penguin-movie-layers';
let _idbPromise = null;
function idb() {
    if (!_idbPromise) {
        _idbPromise = new Promise((resolve, reject) => {
            // v2: descarta as layers gravadas pela v1 — com os .pack
            // corrompidos (CRLF) a sala rasterizava VAZIA e esse resultado
            // em branco era cacheado; a chave (base+ss+fingerprint do
            // manifest) nao muda quando o pack e consertado, entao o hit
            // devolveria a sala preta para sempre.
            const req = indexedDB.open('penguin-movie', 2);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (db.objectStoreNames.contains(LAYER_CACHE)) db.deleteObjectStore(LAYER_CACHE);
                db.createObjectStore(LAYER_CACHE);
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => db.close();
                resolve(db);
            };
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('penguin-movie: upgrade bloqueado'));
        });
    }
    return _idbPromise;
}

export async function layerCacheGet(key) {
    try {
        const db = await idb();
        return await new Promise((res) => {
            const rq = db.transaction(LAYER_CACHE).objectStore(LAYER_CACHE).get(key);
            rq.onsuccess = () => res(rq.result || null);
            rq.onerror = () => res(null);
        });
    } catch { return null; }
}

export async function layerCachePut(key, val) {
    try {
        const db = await idb();
        await new Promise((res) => {
            const tx = db.transaction(LAYER_CACHE, 'readwrite');
            tx.objectStore(LAYER_CACHE).put(val, key);
            tx.oncomplete = res; tx.onerror = res;
        });
        _keys?.add(key);
    } catch { /* cache e best-effort */ }
}

// Chaves existentes (so as chaves — barato): permite saber se uma sala ja
// esta rasterizada SEM baixar/parsear o pack dela (o fingerprint exige o
// timelines.json, que na dance tem ~8.6MB).
let _keys = null;
async function cachedKeys() {
    if (_keys) return _keys;
    try {
        const db = await idb();
        _keys = await new Promise((res) => {
            const rq = db.transaction(LAYER_CACHE).objectStore(LAYER_CACHE).getAllKeys();
            rq.onsuccess = () => res(new Set(rq.result || []));
            rq.onerror = () => res(new Set());
        });
    } catch { _keys = new Set(); }
    return _keys;
}
const keyPrefix = (base, ss) => `v3|${base}|ss${ss.toFixed(2)}|`;

// Pista (sem validar fingerprint): a sala tem layers no cache?
export async function hasCachedLayers(base, ss) {
    const p = keyPrefix(base, ss);
    for (const k of await cachedKeys()) if (typeof k === 'string' && k.startsWith(p)) return true;
    return false;
}

// v3: cache inclui os overlays dinamicos
export function layerCacheKey(base, ss, movie) {
    return `${keyPrefix(base, ss)}${movie.fingerprint()}`;
}

export function canvasToBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, 'image/webp', 0.92));
}

// ---------- Plano da sala: segmentos estaticos + overlays dinamicos ----------
// Segmenta cada top-level layer na ordem de desenho do Flash: subarvores
// estaticas viram "segmentos" (canvas cropado proprio) e sprites animados
// viram overlays — intercalados por depth, restaurando o z-order original.
// Efeito colateral: movie._skipDynamic (layers estaticas nao desenham os
// sprites que viraram overlay).
export function planRoom(movie, ss) {
    const layers = movie.topLevelLayers();
    const collected = layers.map((l, i) => ({ l, i, items: movie.collectItems(l.entry) }));
    const totalDyns = collected.reduce((n, c) => n + c.items.filter((it) => it.type === 'dyn').length, 0);
    if (totalDyns > 60) {
        // sala com animacao demais: fallback — layer inteira estatica
        // (re-render por _dirtyRoots)
        const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        const segments = collected.map(({ l, i }) => ({
            ops: [{ type: 'static', entries: [l.entry], matrix: ID, path: '', color: IDENT_COLOR }],
            order: 0, depth: l.z + i * 0.001 + 0.0005,
            layerIdx: i, layerZ: l.z,
            rootKey: l.entry.name || `#${l.entry.depth}`,
            paths: new Set(), canvas: null, tex: null, img: null, texKey: null, _busy: false,
        }));
        for (const seg of segments) {
            movie.collectPaths(seg.ops[0].entries, '', seg.paths);
            seg.paths.add('');
        }
        movie._skipDynamic = null;
        return { dyns: null, segments };
    }
    movie._skipDynamic = new Set();
    const dyns = [];
    const segs = [];
    for (const { l, i, items } of collected) {
        const base = l.z + i * 0.001;
        const step = 0.0009 / Math.max(1, items.length);
        const rootKey = l.entry.name || `#${l.entry.depth}`;
        let cur = null;
        const flush = () => {
            if (!cur) return;
            cur.depth = base + (cur.order + 1) * step;
            segs.push(cur);
            cur = null;
        };
        items.forEach((it, k) => {
            if (it.type === 'dyn') {
                // overlay so se tiver bounds renderizavel — frames vazios
                // ou maiores que o limite viram op estatico (fallback)
                const db = movie.dynBounds(it.dyn, ss);
                const okDyn = db && (db[2] - db[0] + 8) <= 4000 && (db[3] - db[1] + 8) <= 4000;
                if (okDyn) {
                    flush();
                    it.dyn.layerZ = l.z; it.dyn.layerIdx = i;
                    it.dyn.order = k; it.dyn.depth = base + (k + 1) * step;
                    dyns.push(it.dyn);
                    movie._skipDynamic.add(it.dyn.path);
                    return;
                }
                it = { type: 'static', entries: [it.dyn.entry], matrix: it.dyn.parentMatrix, path: it.dyn.parentPath, color: it.dyn.parentColor };
            }
            if (!cur) cur = { ops: [], order: k, depth: 0, layerIdx: i, layerZ: l.z, rootKey, paths: new Set(), canvas: null, tex: null, img: null, texKey: null, _busy: false };
            cur.ops.push(it);
        });
        flush();
    }
    // paths de cada segmento (para dirty/forced -> re-render cirurgico)
    for (const seg of segs) {
        for (const op of seg.ops) {
            movie.collectPaths(op.entries, op.path, seg.paths);
            if (op.path) seg.paths.add(op.path);
        }
    }
    return { dyns, segments: segs };
}

// Retangulo (device px) do canvas de um segmento = uniao dos ops, com
// padding. null = segmento sem conteudo visivel ou grande demais.
export function segmentRect(movie, seg, ss) {
    let b = null;
    for (const op of seg.ops) {
        const m = op.matrix;
        const dev = { a: ss * m.a, b: ss * m.b, c: ss * m.c, d: ss * m.d, x: ss * m.x, y: ss * m.y };
        const ob = movie._boundsOfEntries(op.entries, dev, op.path);
        if (ob) b = b ? [Math.min(b[0], ob[0]), Math.min(b[1], ob[1]), Math.max(b[2], ob[2]), Math.max(b[3], ob[3])] : ob;
    }
    if (!b) return null;
    const pad = 4;
    const x0 = Math.floor(b[0]) - pad, y0 = Math.floor(b[1]) - pad;
    const w = Math.ceil(b[2]) + pad - x0, h = Math.ceil(b[3]) + pad - y0;
    if (w <= 0 || h <= 0 || w > 8000 || h > 8000) return null;
    return { x0, y0, w, h };
}

// Retangulo (device px) de um overlay dinamico = uniao de todos os frames.
export function dynRect(movie, d, ss) {
    const b = movie.dynBounds(d, ss);
    if (!b) return null;
    const pad = 4;
    const x0 = Math.floor(b[0]) - pad, y0 = Math.floor(b[1]) - pad;
    const w = Math.ceil(b[2]) + pad - x0, h = Math.ceil(b[3]) + pad - y0;
    if (w <= 0 || h <= 0 || w > 4000 || h > 4000) return null;
    return { x0, y0, w, h };
}

// Desenha um segmento estatico no seu canvas (seg.canvas, origem seg.ox/oy).
export async function drawSegment(movie, seg, ss) {
    const ctx = seg.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, seg.canvas.width, seg.canvas.height);
    ctx.translate(-seg.ox, -seg.oy);
    for (const op of seg.ops) {
        const m = op.matrix;
        const dev = { a: ss * m.a, b: ss * m.b, c: ss * m.c, d: ss * m.d, x: ss * m.x, y: ss * m.y };
        try {
            await movie._drawEntries(ctx, op.entries, dev, op.path, op.color, ss, 1);
        } catch (e) {
            console.warn('[seg] draw', op.path, e);
        }
    }
}

// ---------- Pre-render em segundo plano ----------
// Um job por base|ss. prioridade:
//   idle   — so roda em requestIdleCallback e pausa enquanto uma sala carrega
//            (MovieRoom._decodeHold > 0): nao disputa FPS com a sala atual
//   urgent — o jogador esta indo para la (clicou numa porta) ou a sala ja
//            esta carregando: roda direto, cedendo a vez a cada segmento
const jobs = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = () => new Promise((r) => (typeof requestIdleCallback === 'function'
    ? requestIdleCallback(() => r(), { timeout: 2000 })
    : setTimeout(r, 50)));

export function prerenderJob(base, ss) {
    return jobs.get(`${base}|${ss}`) || null;
}

async function gate(job) {
    for (;;) {
        if (job.cancelled) throw new Error('prerender cancelado');
        if (job.urgent) { await sleep(0); return; }
        if (MovieRoom._decodeHold > 0) { await sleep(250); continue; }
        await idle();
        if (!job.urgent && MovieRoom._decodeHold > 0) continue;
        return;
    }
}

// Libera os bitmaps rasterizados do pack (podem ser dezenas de MB por sala):
// o cache de layers ja guarda o resultado; ao visitar, so os overlays que
// animarem re-rasterizam sob demanda.
function releaseArt(movie) {
    for (const p of movie._artCache?.values() || []) {
        Promise.resolve(p).then((b) => { try { b?.close?.(); } catch { /* noop */ } }, () => {});
    }
    movie._artCache?.clear();
    for (const b of movie._tintCache?.values() || []) { try { b?.close?.(); } catch { /* noop */ } }
    movie._tintCache?.clear();
}

// Rasteriza a sala `base` direto no cache de layers. Resolve true quando o
// cache esta pronto (ja existia ou foi gerado), false em falha/cancelamento.
export function prerenderRoom(base, ss, { urgent = false } = {}) {
    const id = `${base}|${ss}`;
    let job = jobs.get(id);
    if (job) {
        if (urgent) job.urgent = true;
        return job;
    }
    job = { base, ss, urgent, cancelled: false, promise: null };
    jobs.set(id, job);
    job.promise = (async () => {
        if (!job.urgent && await hasCachedLayers(base, ss)) return true;
        await gate(job);
        const movie = await MovieRoom.load(base);
        movie.setScale(ss);
        const key = layerCacheKey(base, ss, movie);
        if (await layerCacheGet(key)) return true;
        movie.warmPlayheads();
        const { dyns, segments } = planRoom(movie, ss);
        const layers = [];
        for (const seg of segments) {
            const r = segmentRect(movie, seg, ss);
            if (!r) continue;
            seg.canvas = document.createElement('canvas');
            seg.canvas.width = r.w; seg.canvas.height = r.h;
            seg.ox = r.x0; seg.oy = r.y0;
            layers.push(seg);
        }
        try {
            for (const seg of layers) {
                await gate(job);
                await drawSegment(movie, seg, ss);
            }
            for (const d of dyns || []) {
                const r = dynRect(movie, d, ss);
                if (!r) { d.canvas = null; continue; }
                d.canvas = document.createElement('canvas');
                d.canvas.width = r.w; d.canvas.height = r.h;
                d.ox = r.x0; d.oy = r.y0;
                await gate(job);
                try { await movie.renderSpriteDynamic(d, ss); } catch (e) { console.warn('[prerender] dyn', d.path, e); }
            }
            const blobs = [];
            for (const seg of layers) blobs.push(await canvasToBlob(seg.canvas));
            const dynBlobs = [];
            for (const d of dyns || []) dynBlobs.push(d.canvas ? await canvasToBlob(d.canvas) : null);
            if (!blobs.every(Boolean) || !dynBlobs.every((b, i) => b || !(dyns || [])[i]?.canvas)) return false;
            await layerCachePut(key, { layers: blobs, dyns: dynBlobs, ts: Date.now() });
            return true;
        } finally {
            // canvases grandes: zera para o GC devolver a memoria logo
            for (const seg of layers) { seg.canvas.width = 0; seg.canvas = null; }
            for (const d of dyns || []) if (d.canvas) { d.canvas.width = 0; d.canvas = null; }
            releaseArt(movie);
        }
    })().catch((e) => {
        if (!job.cancelled) console.warn('[prerender]', base, e);
        return false;
    }).finally(() => {
        if (jobs.get(id) === job) jobs.delete(id);
    });
    return job;
}

// Cancela jobs de idle cujas salas nao estao em `keep` (Set de bases).
// Jobs urgentes (jogador indo para la) nunca sao cancelados.
export function cancelPrerenders(keep = new Set()) {
    for (const job of jobs.values()) {
        if (!job.urgent && !keep.has(job.base)) job.cancelled = true;
    }
}
