// Renderizador vetorial de "movies" do GoPenguin web (timelines.json + chars/*.pack).
// Os pacotes contem display lists Flash achatadas: frames de {depth,id,matrix}
// cujos ids resolvem para sprites (sub-timelines) ou characters (shapes SVG,
// botoes, texto pre-renderizado). SVGs sao rasterizados sob demanda em alta
// resolucao — equivalente ao visual vetorial do gopenguin.lol.

export const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// ---------- Cache IndexedDB dos chunks de arte ----------
// Os chunks têm hash de conteúdo no nome (chunk-N-<hash>.pack) => imutáveis,
// podem ser cacheados para sempre. timelines.json NÃO é cacheado (manifest
// pode mudar quando os assets são regerados).
let _packDbPromise = null;
function packDb() {
    if (!_packDbPromise) {
        _packDbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('penguin-packs', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('chunks');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return _packDbPromise;
}
async function packGet(url) {
    try {
        const db = await packDb();
        return await new Promise((res) => {
            const rq = db.transaction('chunks').objectStore('chunks').get(url);
            rq.onsuccess = () => res(rq.result || null);
            rq.onerror = () => res(null);
        });
    } catch { return null; }
}
function packPut(url, buf) {
    packDb().then((db) => {
        const tx = db.transaction('chunks', 'readwrite');
        tx.objectStore('chunks').put(buf, url);
    }).catch(() => {});
}
// só chunks com hash de conteúdo no nome são imutáveis; chars.pack sem hash
// pode mudar quando os assets são regerados -> cacheado com chave
// `${url}@${source}` (hash do timelines.json que o referencia)
const isImmutableChunk = (u) => /chunk-[^/]*-[0-9a-f]{6,}\.pack$/i.test(u);
async function fetchPack(url, cacheKey) {
    const key = cacheKey ?? (isImmutableChunk(url) ? url : null);
    if (key) {
        const hit = await packGet(key);
        if (hit) return hit;
    }
    const buf = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url} ${r.status}`);
        return r.arrayBuffer();
    });
    if (key) packPut(key, buf);
    return buf;
}

// worker singleton p/ parsear manifests de timelines.json fora da main
// thread (dance = ~8.6MB de JSON — parse sincrono seria long task)
let _manifestWorker = null;
// Images de SVG aguardando decode no browser (fila FIFO interna) —
// teto para o prefetch agendado nao lotar a fila a frente do load real
let _pendingImages = 0;
const _MAX_PENDING_IMAGES = 250;

// Semaforo global de rasterizacao SVG->bitmap: createImageBitmap em SVG e
// caro e o browser estrangula quando centenas sao disparadas juntas (um
// warm de prefetch enfileirava tudo e o render da pagina esperava minutos
// atras dos bitmaps de fundo). Chamadas de render (foreground) tem
// prioridade sobre as de prefetch (background).
const _ART_SLOTS = 6;
let _artActive = 0;
const _artWaitFg = [], _artWaitBg = [];
function _artAcquire(bg) {
    if (_artActive < _ART_SLOTS) { _artActive++; return Promise.resolve(); }
    return new Promise((res) => (bg ? _artWaitBg : _artWaitFg).push(res));
}
function _artRelease() {
    const n = _artWaitFg.shift() || _artWaitBg.shift();
    if (n) n(); else _artActive--;
}
function _getManifestWorker() {
    if (typeof Worker === 'undefined') return null;
    if (!_manifestWorker) {
        _manifestWorker = new Worker(
            new URL('../workers/manifest.worker.js', import.meta.url),
            { type: 'module' });
    }
    return _manifestWorker;
}

// Pool de workers p/ tint por pixel: o loop getImageData/putImageData e
// CPU-bound e sincronico — num cold load de sala com sprites tintados
// bloqueava a main thread por segundos. ImageBitmap e transferivel,
// entao o worker recebe os pixels, tinda e devolve um bitmap novo.
let _tintPool = null;
const _tintQueue = [];
function _getTintPool() {
    if (typeof Worker === 'undefined') return null;
    if (!_tintPool) {
        const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
        _tintPool = [];
        for (let i = 0; i < n; i++) {
            try {
                const w = new Worker(
                    new URL('../workers/tint.worker.js', import.meta.url),
                    { type: 'module' });
                const slot = { w, busy: false, dead: false };
                w.onerror = () => { slot.dead = true; };
                _tintPool.push(slot);
            } catch { /* sem suporte a worker */ }
        }
        if (!_tintPool.length) _tintPool = null;
    }
    return _tintPool;
}

function _pumpTintQueue() {
    const pool = _getTintPool();
    if (!pool) {
        let j; while ((j = _tintQueue.shift())) j.resolve(null);
        return;
    }
    for (const slot of pool) {
        if (slot.busy || slot.dead || !_tintQueue.length) continue;
        const job = _tintQueue.shift();
        slot.busy = true;
        let done = false;
        const finish = (bmp) => {
            if (done) return;
            done = true;
            clearTimeout(job.timer);
            slot.w.removeEventListener('message', onMsg);
            slot.busy = false;
            job.resolve(bmp);
            _pumpTintQueue();
        };
        const onMsg = (e) => finish(e.data?.bitmap || null);
        slot.w.addEventListener('message', onMsg);
        job.timer = setTimeout(() => finish(null), 15000);
        try {
            slot.w.postMessage({ bitmap: job.bitmap, mult: job.mult, add: job.add }, [job.bitmap]);
        } catch { finish(null); }
    }
    if (_tintQueue.length) setTimeout(_pumpTintQueue, 8);
}

// Enfileira um tint; resolve ImageBitmap ou null (caller cai no fallback).
function _tintBitmap(bitmap, mult, add) {
    if (typeof Worker === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
        _tintQueue.push({ bitmap, mult, add, resolve });
        setTimeout(_pumpTintQueue, 0);
    });
}

const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const arrMat = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });

// colorTransform do Flash: mult (0..1) + offset (0..255)
const colorMul = (p, c) => ({
    mult: p.mult.map((v, i) => v * c.mult[i]),
    add: p.mult.map((v, i) => v * c.add[i] + p.add[i]),
});
const colorIdentity = (c) =>
    c.mult.every((v) => v === 1) && c.add.every((v) => v === 0);

export class MovieRoom {
    // Hold global de decode agendado (_scheduleDecode): >0 pausa todas as
    // chains de prefetch em idle. RoomScene incrementa durante o load de
    // uma sala para o decode de fundo de OUTRAS salas nao competir.
    static _decodeHold = 0;

    // base: '/assets/movies/town'
    // Assets imutaveis compartilhados entre instancias do mesmo pack:
    // timelines parseado, packs, indice de arquivos, exits/interactions
    // parseados e TODOS os caches de decode/raster (_svg/_img/_art/_tint/
    // _font). Revisita de sala/sprite pula fetch+parse+decode — so o estado
    // de playback (playheads, botoes, dirty sets) e recriado por instancia.
    // LRU por base; catalogos/roupas sao entries pequenas, salas ficam quentes.
    static _sharedAssets = new Map(); // base -> Promise<SharedAssets>
    static _SHARED_MAX = 24;

    static async load(base) {
        let entry = MovieRoom._sharedAssets.get(base);
        if (!entry) {
            entry = MovieRoom._loadShared(base).catch((e) => {
                MovieRoom._sharedAssets.delete(base);
                throw e;
            });
            MovieRoom._sharedAssets.set(base, entry);
            while (MovieRoom._sharedAssets.size > MovieRoom._SHARED_MAX)
                MovieRoom._sharedAssets.delete(MovieRoom._sharedAssets.keys().next().value);
        }
        MovieRoom._sharedAssets.delete(base);
        MovieRoom._sharedAssets.set(base, entry); // LRU touch
        return MovieRoom._fromShared(base, await entry);
    }

    // Fetch + parse + packs — roda UMA vez por base; o resultado e
    // compartilhado por todas as instancias (dados read-only).
    static async _loadShared(base) {
        const tl = await fetch(`${base}/timelines.json`).then((r) => {
            if (!r.ok) throw new Error(`timelines.json ${r.status}`);
            return r.json();
        });
        const packs = [];
        const urls = [];
        const charsUrl = tl.pack?.file ? `${base}/chars/${tl.pack.file}` : null;
        if (charsUrl) urls.push(charsUrl);
        for (const f of tl.chunks?.files ?? []) urls.push(`${base}/chars/${f}`);
        // chars.pack nao tem hash no nome: cacheia no IDB com chave
        // url@source — source muda quando os assets sao regerados
        const srcKey = tl.source || '';
        await Promise.all(urls.map(async (u) => {
            const buf = await fetchPack(u, u === charsUrl ? `${u}@${srcKey}` : undefined);
            packs.push({ name: u.split('/').pop(), buf });
        }));

        // indice arquivo -> {pack, off, len}
        const files = new Map();
        if (tl.pack?.entries) {
            const packBuf = packs.find((p) => p.name === tl.pack.file);
            for (const [file, [off, len]] of Object.entries(tl.pack.entries))
                files.set(file, { pack: packBuf, off, len });
        }
        const chunkFiles = (tl.chunks?.files ?? []).map((f) =>
            packs.find((p) => p.name === f));
        for (const [file, e] of Object.entries(tl.chunks?.entries ?? {})) {
            // entries: [chunkIndex, offset, length] ou [offset, length]
            if (e.length === 3) files.set(file, { pack: chunkFiles[e[0]], off: e[1], len: e[2] });
            else files.set(file, { pack: chunkFiles[0], off: e[0], len: e[1] });
        }

        // parse AS das interacoes uma vez — deterministico a partir do tl
        const tmp = Object.create(MovieRoom.prototype);
        tmp._mainTl = { frames: tl.main?.frames ?? [[]], labels: tl.main?.labels ?? {}, actions: tl.main?.actions ?? {} };
        tmp.sprites = tl.sprites || {};
        const exits = tmp._parseExits();
        tmp._parseInteractions();

        return {
            tl, packs, files, exits, interactions: tmp.interactions,
            svgCache: new Map(), imgCache: new Map(),
            artCache: new Map(), tintCache: new Map(), fontCache: new Map(),
            svgOverrides: new Map(),
        };
    }

    // P4: baixa os packs de uma sala para o IDB sem parsear o timelines na
    // main thread (worker extrai so o manifesto). chunks imutaveis e
    // chars.pack (chave url@source) ficam quentes — o proximo load acha
    // tudo em IDB. Usado pelo prefetch em idle do RoomScene.
    static prefetchRoom(base) {
        const w = _getManifestWorker();
        if (!w) return Promise.resolve();
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                w.removeEventListener('message', onMsg);
                resolve();
            }, 60000);
            const onMsg = (e) => {
                const d = e.data;
                if (!d || d.base !== base) return;
                w.removeEventListener('message', onMsg);
                clearTimeout(timer);
                const key = (u) => (u === d.charsUrl ? `${u}@${d.source || ''}` : undefined);
                Promise.allSettled((d.urls || []).map((u) => fetchPack(u, key(u))))
                    .then(() => resolve());
            };
            w.addEventListener('message', onMsg);
            w.postMessage(base);
        });
    }

    // Nova instancia sobre os assets compartilhados: estado de playback
    // sempre limpo (equivale ao load antigo, mas sem fetch/parse/decode).
    static _fromShared(base, s) {
        const room = new MovieRoom();
        const tl = s.tl;
        room.base = base;
        room.data = tl;
        room.sprites = tl.sprites || {};
        room.characters = tl.characters || {};
        room.stage = tl.stage || { width: 760, height: 480, frameRate: 24 };
        room.rate = room.stage.frameRate || 24;
        room.packs = s.packs;
        room.files = s.files;
        room._svgCache = s.svgCache;
        room._imgCache = s.imgCache;
        room._artCache = s.artCache;
        room._tintCache = s.tintCache;
        room._fontCache = s.fontCache;
        room._svgOverrides = s.svgOverrides;
        room._playheads = new Map();  // path -> playhead "ativo" (ultimo resolvido; goto/currentFrame)
        room._playheadAll = new Map(); // path+''+spriteId -> playhead (instancias co-existentes)
        room._buttonStates = new Map(); // path -> 'up'|'over'|'down' (interacoes)
        room._forcedDirty = new Set(); // roots sujos por interacao (fora do tick)
        room._forcedPaths = new Set(); // paths completos sujos por interacao
        room._dirtyPaths = new Set();  // paths que avancaram no ultimo tick
        room._dirtyForced = new Set(); // roots sujos por interacao no ultimo tick
        room._dirtyForcedPaths = new Set(); // paths completos sujos no ultimo tick
        room._skipDynamic = null;      // paths de sprites animados (overlays)
        room._scale = 1;
        room.language = 'english';    // clips de idioma ficam estaticos no frame do idioma
        room._mainTl = { frames: tl.main?.frames ?? [[]], labels: tl.main?.labels ?? {}, actions: tl.main?.actions ?? {}, sounds: tl.main?.sounds ?? [] };
        room._mainFrame = 1;          // frame atual da timeline principal (1-based; catalogos = paginas)
        room._state = new Map();      // path -> {visible?, text?, entryId?} (set() do Clip do gp)
        room._nodes = new Map();      // path -> {entry, matrix} do ultimo collectInteractive
        room._sndQueue = null;         // ids de som de timeline "entrados" — null = sons desligados (sem leak em salas)
        room.editTexts = tl.editTexts || {};
        room.fonts = tl.fonts || {};
        room.scalingGrids = tl.scalingGrids || {};
        room.exits = s.exits;
        room.interactions = s.interactions;
        return room;
    }

    // Parser generico do ActionScript das salas (fontes em main.actions e
    // sprites[].actions). Extrai, por path dot-notation:
    //   click[path]  = {walk:[x,y]} | {content:"X"} | {game:"X"}  (onRelease)
    //   trigContent[name] = "X_catalogue" (triggerFunction -> showContent)
    //   trigGame[name]    = "X"           (triggerFunction -> sendGame)
    //   disabled    = Set<path> (useHandCursor=false)
    // Port simplificado do parser 'ti/as' do bundle gopenguin.
    _parseInteractions() {
        const ci = { click: {}, trigContent: {}, trigGame: {}, trigTable: {}, hint: {}, disabled: new Set() };
        const sources = [];
        const collect = (acts) => {
            for (const a of Object.values(acts || {})) {
                const s = typeof a === 'string' ? a : (a && a.source) || '';
                if (s) sources.push(s);
            }
        };
        collect(this._mainTl.actions);
        for (const sp of Object.values(this.sprites || {})) collect(sp.actions);

        const classify = (body) => {
            const mv = /sendPlayerMove\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(body);
            if (mv) return { walk: [Number(mv[1]), Number(mv[2])] };
            const sc = /showContent\(\s*["']([\w-]+)["']\s*\)/.exec(body);
            if (sc) return { content: sc[1] };
            const gm = /send(?:Join)?Game\(\s*["']([\w-]+)["']/.exec(body);
            if (gm) return { game: gm[1] };
            const tb = /sendJoinTable\(\s*["'](\w+)["']\s*,\s*(\d+)/.exec(body);
            if (tb) return { table: { game: tb[1], id: Number(tb[2]) } };
            const wd = /sendJoinWaddle\(\s*["'](\w+)["']\s*,\s*(\d+)/.exec(body);
            if (wd) return { table: { game: wd[1], id: Number(wd[2]) } };
            const jr = /sendJoinRoom\(\s*["']([\w-]+)["']\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(body);
            if (jr) return { room: jr[1], x: Number(jr[2]), y: Number(jr[3]) };
            return null;
        };

        for (const src of sources) {
            // path.onRelease = function() { ... }
            const reRel = /([\w.]+)\.onRelease\s*=\s*function\s*\(\s*\)\s*\{([\s\S]*?)\}/g;
            let m;
            while ((m = reRel.exec(src))) {
                const act = classify(m[2]);
                if (act) ci.click[m[1]] = act;
            }
            // triggers_mc.nome.triggerFunction
            const reTr = /triggers_mc\.(\w+)\.triggerFunction\s*=\s*function\s*\(\s*\)\s*\{([\s\S]*?)\}/g;
            while ((m = reTr.exec(src))) {
                const act = classify(m[2]);
                if (act?.content) ci.trigContent[m[1]] = act.content;
                else if (act?.game) ci.trigGame[m[1]] = act.game;
                else if (act?.table) ci.trigTable[m[1]] = act.table;
            }
            // path.onRollOver = function() { INTERFACE.showHint(this,"x_hint"); }
            const reOver = /([\w.]+)\.onRollOver\s*=\s*function\s*\(\s*\)\s*\{([\s\S]*?)\}/g;
            while ((m = reOver.exec(src))) {
                const h = /showHint\([^,]+,\s*["']([\w-]+)["']\)/.exec(m[2]);
                // 'mc.game_btn' e parametro do setupTable(mc), nao path real —
                // o sufixo 'game_btn' casaria com TODAS as mesas da sala
                if (h && !m[1].startsWith('mc.')) ci.hint[m[1]] = h[1];
            }
            // path.useHandCursor = false -> nao interativo
            const reDis = /([\w.]+)\.useHandCursor\s*=\s*false/g;
            while ((m = reDis.exec(src))) ci.disabled.add(m[1]);
        }
        this.interactions = ci;
    }

    // Lookup por sufixo: 'interface_mc.clothing_btn_states.clothing_btn' casa
    // com botao de path '...clothing_btn' ou nome 'clothing_btn'.
    _matchPath(map, path, name) {
        if (map[path]) return map[path];
        for (const k of Object.keys(map))
            if (path.endsWith('.' + k) || k.endsWith('.' + path) || k === name) return map[k];
        return undefined;
    }

    // Parseia os triggerFunction das saidas da sala no source AS3 do frame 1:
    //   triggers_mc.dock_mc.triggerFunction = function() { ENGINE.sendJoinRoom("dock",600,200); }
    // Retorna { nome: { room, x, y } } — port simplificado do parser do gp-index.
    _parseExits() {
        const exits = {};
        const acts = this._mainTl.actions || {};
        const sources = [];
        for (const a of Object.values(acts)) {
            if (a && !Array.isArray(a) && typeof a.source === 'string') sources.push(a.source);
            else if (typeof a === 'string') sources.push(a);
        }
        for (const src of sources) {
            const re = /triggers_mc\.(\w+)\.triggerFunction\s*=\s*function\s*\(\)\s*\{([\s\S]*?)\}/g;
            let m;
            while ((m = re.exec(src))) {
                const join = /sendJoinRoom\(\s*["']([\w-]+)["']\s*,\s*(\d+)\s*,\s*(\d+)\)/.exec(m[2]);
                if (join) exits[m[1]] = { room: join[1], x: Number(join[2]), y: Number(join[3]) };
            }
        }
        return exits;
    }

    // Fingerprint barato do conteudo do pack (nº arquivos + bytes) —
    // usado como parte da chave do cache de layers no IndexedDB.
    fingerprint() {
        if (this._fp !== undefined) return this._fp;
        let n = 0, bytes = 0;
        for (const ref of this.files.values()) { n++; bytes += ref.len || 0; }
        this._fp = `${n}:${bytes}`;
        return this._fp;
    }

    setScale(scale) {
        // caches sao compartilhados entre instancias e as chaves ja incluem
        // scale — nao limpar: preserva a arte rasterizada de visitas anteriores
        this._scale = scale;
    }

    // Override de arte por arquivo (ex.: trocar o glifo "?" do botao de
    // rename do player card por um lapis). Compartilhado entre instancias
    // do mesmo pack — os caches sao os mesmos, entao tambem os purga.
    setSvgOverride(file, svg) {
        if (!this._svgOverrides) this._svgOverrides = new Map();
        this._svgOverrides.set(file, svg);
        this._svgCache?.delete(file);
        this._imgCache?.delete(file);
        const prefix = `${file}|`;
        for (const cache of [this._artCache, this._tintCache]) {
            for (const k of [...(cache?.keys() || [])])
                if (k.startsWith(prefix)) cache.delete(k);
        }
    }

    _svgText(file) {
        const o = this._svgOverrides?.get(file);
        if (o !== undefined) return o;
        let s = this._svgCache.get(file);
        if (s !== undefined) return s;
        const ref = this.files.get(file);
        if (!ref || !ref.pack) { this._svgCache.set(file, null); return null; }
        const bytes = new Uint8Array(ref.pack.buf, ref.off, ref.len);
        s = new TextDecoder().decode(bytes);
        this._svgCache.set(file, s);
        return s;
    }

    _svgImage(file) {
        let p = this._imgCache.get(file);
        if (p) return p;
        const svg = this._svgText(file);
        if (!svg) { this._imgCache.set(file, Promise.resolve(null)); return this._imgCache.get(file); }
        p = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
        // backlog global de decode: o browser decodifica Images em fila
        // FIFO — sem teto, prefetch de varias salas enfileirava milhares
        // de SVGs e a entrada na proxima sala esperava a fila inteira
        // (~45s medido). _scheduleDecode respeita _pendingImages.
        _pendingImages++;
        p.finally(() => { _pendingImages--; });
        this._imgCache.set(file, p);
        return p;
    }

    // Dispara o decode de todos os SVGs referenciados pelos characters.
    // _svgImage cacheia promises, entao o desenho sequencial seguinte
    // (renderLayer/_drawShape) encontra as imagens prontas.
    // Sem isso cada layer esperava um decode por vez: ~60s para a town.
    // chunk > 0 limita os Image pendentes por macrotask — packs grandes
    // (penguin = ~1800 SVGs) nao saturam a fila de decode de uma vez.
    // agenda o decode dos arquivos via requestIdleCallback: so decodifica
    // quando a main thread esta ociosa — setTimeout(0) em cadeia faminto
    // o rAF e derrubava o FPS para ~9 durante o warm-up. Timeout de 1.5s
    // garante throughput mesmo com o jogo rodando (sem timeout o rIC
    // quase nao disparava sob carga e o prefetch de outras salas ficava
    // lento demais para servir de algo). MovieRoom._decodeHold pausa
    // TODAS as chains durante transicao de sala (RoomScene segura) —
    // decode de fundo nunca compete com o load da sala destino.
    _scheduleDecode(files, chunk = 4) {
        if (!files.length) return;
        const sched = typeof requestIdleCallback === 'function'
            ? (fn) => requestIdleCallback(fn, { timeout: 1500 })
            : (fn) => setTimeout(fn, 50);
        let i = 0;
        const step = () => {
            if (MovieRoom._decodeHold > 0 || _pendingImages > _MAX_PENDING_IMAGES) {
                sched(step);
                return;
            }
            for (let j = 0; j < chunk && i < files.length; j++, i++)
                this._svgImage(files[i]);
            if (i < files.length) sched(step);
        };
        sched(step);
    }

    // Warm ritmado de artCanvas (background): drena a fila de raster do
    // catalogo durante a leitura sem inundar a fila de decode de SVGs —
    // mesmo padrao do _scheduleDecode (rIC + teto de Images pendentes).
    _scheduleArtWarm(items, scale, chunk = 8) {
        if (!items.length) return;
        const sched = typeof requestIdleCallback === 'function'
            ? (fn) => requestIdleCallback(fn, { timeout: 1500 })
            : (fn) => setTimeout(fn, 50);
        let i = 0;
        const step = () => {
            if (MovieRoom._decodeHold > 0 || _pendingImages > _MAX_PENDING_IMAGES) {
                sched(step);
                return;
            }
            for (let j = 0; j < chunk && i < items.length; j++, i++) {
                const [f, ch] = items[i];
                this.artCanvas(f, ch, scale, true);
            }
            if (i < items.length) sched(step);
        };
        sched(step);
    }

    prefetchSvgs(chunk = 0) {
        const files = [...new Set(
            Object.values(this.characters || {})
                .map((c) => c.file).filter(Boolean)
        )];
        if (!chunk) {
            for (const f of files) this._svgImage(f);
            return;
        }
        this._scheduleDecode(files, chunk);
    }

    // Prefetch priorizado: decodifica so os SVGs alcancaveis pelos frames
    // informados da timeline principal (entries -> sprites -> seus frames ->
    // characters.file). Usado pelo pinguim para garantir que walk/idle/sit
    // com as roupas equipadas estejam prontos antes do primeiro uso —
    // sem isso o primeiro andar "deslizava" esperando decodes de SVG.
    prefetchFrames(frameNums, chunk = 12, immediate = false, scale = null, bg = true) {
        const files = new Set();
        const arts = new Map(); // file -> char (para warm de artCanvas)
        const seenSprites = new Set();
        const walk = (entries) => {
            for (const e of entries || []) {
                const sid = String(e.id);
                const sp = this.sprites?.[sid];
                if (sp) {
                    if (seenSprites.has(sid)) continue;
                    seenSprites.add(sid);
                    for (const fr of sp.frames || []) walk(fr);
                    continue;
                }
                const ch = this.characters?.[sid];
                if (ch?.file) {
                    files.add(ch.file);
                    if (!arts.has(ch.file)) arts.set(ch.file, ch);
                }
            }
        };
        const main = this.data?.main;
        const len = main?.frames?.length || 1;
        for (const n of frameNums || []) {
            const f = Math.max(1, Math.min(len, Math.round(n) || 1));
            walk(main?.frames?.[f - 1]);
        }
        // immediate: dispara todos os _svgImage de uma vez (decode paralelo
        // do browser) — usado pelo catalogo, onde a pagina alvo nao pode
        // esperar o requestIdleCallback (que morre de fome durante renders)
        if (immediate) {
            if (bg) {
                // warm de fundo: RITMADO — disparar _svgImage/artCanvas para
                // centenas de arquivos de uma vez estoura a fila de decode
                // do browser (_MAX_PENDING_IMAGES) e o render da pagina
                // atual espera atras do warm inteiro
                if (scale != null) this._scheduleArtWarm([...arts.entries()], scale);
                else this._scheduleDecode([...files], chunk);
                return;
            }
            for (const f of files) this._svgImage(f);
            // scale: ja rasteriza os artCanvas — o renderFrame espera cada
            // createImageBitmap em serie (~30-50ms/shape), o que dominava
            // o custo de primeira visita de cada pagina
            if (scale != null) {
                for (const [f, ch] of arts) this.artCanvas(f, ch, scale, false);
            }
            return;
        }
        this._scheduleDecode([...files], chunk);
    }

    // Rasteriza o SVG na escala informada (vetorial -> nitido).
    // Retorna ImageBitmap (ou canvas no fallback) — drawImage aceita ambos.
    // createImageBitmap rasteriza o SVG de forma assincrona no pipeline de
    // decode do Chrome, em vez do drawImage sincronico na canvas — um dos
    // gargalos do cold load de salas com muitos shapes.
    // Cacheia a PROMISE (nao so o resultado): chamadas concorrentes para o
    // mesmo file|scale (warm de prefetch + drawEntries do render) dividem o
    // mesmo createImageBitmap em vez de duplicar a rasterizacao.
    artCanvas(file, char, scale, bg = false) {
        const key = `${file}|${+scale.toFixed(3)}`;
        let p = this._artCache.get(key);
        if (p) return p;
        p = (async () => {
            const img = await this._svgImage(file);
            if (!img) return null;
            // size[0]=0 existe em shapes degenerados do Flash (ex.: a linha
            // de pesca do Ice Fishing, retangulo 0x100) — ?? manteria 0 e o
            // bitmap sairia 1px. || cai no tamanho natural do SVG.
            const w = char?.size?.[0] || img.naturalWidth;
            const h = char?.size?.[1] || img.naturalHeight;
            const cw = Math.max(1, Math.ceil(w * scale));
            const ch = Math.max(1, Math.ceil(h * scale));
            let c;
            await _artAcquire(bg);
            try {
                c = await createImageBitmap(img, { resizeWidth: cw, resizeHeight: ch });
            } catch {
                c = document.createElement('canvas');
                c.width = cw; c.height = ch;
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, cw, ch);
            } finally {
                _artRelease();
            }
            c._scale = scale;
            return c;
        })();
        this._artCache.set(key, p);
        p.catch(() => { if (this._artCache.get(key) === p) this._artCache.delete(key); });
        return p;
    }

    // Caminho rapido do tint: bitmap base do cache -> copia transferivel
    // -> worker aplica mult+add por pixel -> bitmap tintado. A copia via
    // createImageBitmap nao consome o bitmap base (reutilizado por outros
    // tints e pelo desenho sem tint).
    async _tintedBitmap(file, char, color, scale, ck) {
        const base = await this.artCanvas(file, char, scale);
        if (!base) return null;
        let copy = null;
        try { copy = await createImageBitmap(base); } catch { return null; }
        const tinted = await _tintBitmap(copy, color.mult, color.add);
        if (!tinted) { try { copy.close?.(); } catch {} return null; }
        tinted._scale = scale;
        this._tintCache.set(ck, tinted);
        return tinted;
    }

    // Variante com colorTransform (mult+add) — exato por pixel, como no
    // cliente web (clip.js _pixelTint). multiply+lighter dava fringing/glow.
    async tintedCanvas(file, char, color, scale) {
        const ck = `${file}|${color.mult.join(',')}|${color.add.join(',')}|${+scale.toFixed(3)}`;
        let c = this._tintCache.get(ck);
        if (c && c._scale === scale) return c;
        const fast = await this._tintedBitmap(file, char, color, scale, ck);
        if (fast) return fast;
        // fallback: canvas + getImageData na main thread
        const base = await this.artCanvas(file, char, scale);
        if (!base) return null;
        c = document.createElement('canvas');
        c.width = base.width; c.height = base.height; c._scale = scale;
        const ctx = c.getContext('2d');
        ctx.drawImage(base, 0, 0);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const d = img.data;
        const m = color.mult, a = color.add;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, Math.max(0, d[i] * m[0] + a[0]));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * m[1] + a[1]));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * m[2] + a[2]));
            d[i + 3] = Math.min(255, Math.max(0, d[i + 3] * m[3] + a[3]));
        }
        ctx.putImageData(img, 0, 0);
        this._tintCache.set(ck, c);
        return c;
    }

    _actions(tl, frame) {
        const a = tl.actions?.[frame] ?? tl.actions?.[String(frame)];
        if (!a) return [];
        if (Array.isArray(a)) return a;
        return a.commands ?? [];
    }

    _labelFrame(tl, label) {
        const v = tl.labels?.[label];
        return typeof v === 'number' ? v : null;
    }

    // Avanca playheads (chamado no tick da sala, ~24fps).
    // _dirtyRoots: conjunto de roots top-level (entry.name ou '#depth') cujos
    // playheads mudaram de frame — a sala re-renderiza so essas layers.
    tick() {
        this._dirty = false;
        this._dirtyRoots = new Set();
        this._dirtyPaths = new Set();   // paths completos que avancaram (overlays)
        // frames "entrados" neste tick (path -> frame), capturados ANTES das
        // acoes do frame — um gotoAndStop no mesmo tick (ex.: puffle 237 -> 1)
        // faria o frame intermediario nunca ser observado via currentFrame.
        this._entered = new Map();
        for (const h of this._playheadAll.values()) {
            const root = (h.path || '').split('.')[0];
            const cmds = this._actions(h.tl, h.frame);
            if (h.stopped) {
                if (cmds.some((c) => c[0] === 'play')) {
                    h.stopped = false; this._dirty = true;
                    this._dirtyRoots.add(root);
                    this._dirtyPaths.add(h.path);
                }
                continue;
            }
            let next = h.frame + 1;
            const len = h.tl.frames.length || 1;
            if (next > len) next = 1;
            if (next !== h.frame) {
                this._dirty = true;
                this._dirtyRoots.add(root);
                this._dirtyPaths.add(h.path);
            }
            h.frame = next;
            this._entered.set(h.path, next);
            this._emitSounds(h.tl, next, h);
            for (const c of this._actions(h.tl, next)) {
                const op = c[0], arg = c[1];
                if (op === 'stop') h.stopped = true;
                else if (op === 'play') h.stopped = false;
                else if (op === 'gotoAndStop' || op === 'gotoAndPlay') {
                    const f = typeof arg === 'string' ? this._labelFrame(h.tl, arg) : Number(arg);
                    if (f) {
                        h.frame = f;
                        h.stopped = op === 'gotoAndStop';
                        this._emitSounds(h.tl, f, h);
                        // NAO registra o destino do salto em _entered: o
                        // frame "avancado" (ex.: puffle 237) e o que o
                        // watch precisa observar; o gotoAndStop(1) e acao
                        // do frame, nao um frame navegado.
                        this._dirty = true;
                        this._dirtyRoots.add(root);
                        this._dirtyPaths.add(h.path);
                    }
                } else if (op === 'nextFrame' || op === 'prevFrame') {
                    // aproximacao: segue o fluxo normal
                }
            }
            // targets = acoes cross-clip ([path, metodo, arg]) — ficam fora
            // de commands[] e sem isto nunca executam. Caso real: sprite
            // 151 da linha do Ice Fishing tem "_parent.gotoAndStop(1)" no
            // frame 19; ignorado, a linha ficava presa no frame de choque.
            const raw = h.tl.actions?.[next] ?? h.tl.actions?.[String(next)];
            const tgts = raw && !Array.isArray(raw) ? (raw.targets ?? []) : [];
            for (const tg of tgts) {
                const [tp, meth, arg] = tg;
                if (tp !== '_parent') continue;
                // path do filho: 'a.b.nome' ou 'a.b#depth' (entries sem
                // nome usam '#' como separador, nao '.') — o pai e o path
                // sem o ultimo segmento, seja qual for o separador.
                const pp = h.path.replace(/[.#][^.#]*$/, '');
                const ph = pp && this._playheads.get(pp);
                if (!ph || !ph.tl) continue;
                if (meth === 'gotoAndStop' || meth === 'gotoAndPlay') {
                    const f = typeof arg === 'string' ? this._labelFrame(ph.tl, arg) : Number(arg);
                    if (f) {
                        ph.frame = Math.max(1, Math.min(f, ph.tl.frames.length || 1));
                        ph.stopped = meth === 'gotoAndStop';
                        this._dirty = true;
                        this._dirtyRoots.add(root);
                        this._dirtyPaths.add(pp);
                    }
                } else if (meth === 'stop' || meth === 'play') {
                    ph.stopped = meth === 'stop';
                    this._dirty = true;
                    this._dirtyRoots.add(root);
                }
            }
        }
        // roots sujos por interacao (hover/botao) — layers estaticas ainda
        // precisam re-renderizar nesses casos
        this._dirtyForced = new Set(this._forcedDirty);
        for (const r of this._forcedDirty) this._dirtyRoots.add(r);
        this._forcedDirty.clear();
        // paths completos: overlays dinamicos que CONTEM o path sujo
        // (botao/texto dentro de sprite animado) tambem precisam re-render
        this._dirtyForcedPaths = new Set(this._forcedPaths);
        this._forcedPaths.clear();
        this._sweepOrphanSounds();
    }

    // No Flash, quando o frame do pai troca, a instancia filha e destruida
    // e seus sons morrem junto. Nossos playheads sobrevivem orfaos em
    // _playheadAll — ex.: sprite 214 (raio do electro do penguin) manda
    // _parent.gotoAndStop(1) no frame 19, o penguin volta ao 'sit' sem o
    // filho, e o playhead ficava ciclando 1->19->1 re-emitindo o som do
    // frame 1 para sempre. Calcula os paths vivos na display list uma vez
    // por tick e muta os orfaos: eles seguem avancando (barato, e se o pai
    // voltar ao frame certo o som volta a funcionar) mas nao emitem mais.
    _sweepOrphanSounds() {
        const heads = new Map();
        for (const h of this._playheadAll.values())
            heads.set(h.path + '' + String(h.sid), h);
        const live = new Set();
        const walkLive = (entries, path) => {
            for (const e of entries || []) {
                const sid = String(e.id);
                if (!this.sprites[sid]) continue;
                const cp = this._path(path, e);
                live.add(cp);
                const hh = heads.get(cp + '' + sid);
                if (hh) walkLive(hh.tl.frames[hh.frame - 1], cp);
            }
        };
        walkLive(this._mainTl.frames[this._mainFrame - 1] || [], '');
        for (const h of this._playheadAll.values())
            h.muted = !live.has(h.path);
    }

    _playhead(path, tlId) {
        const tl = this.sprites[tlId] || (tlId === 'main' ? this._mainTl : null);
        if (!tl) return null;
        // Instancia = (path, spriteId): catalogos recolocam sprites
        // diferentes com o mesmo nome em paginas diferentes (ex.: 'secret',
        // 'flag', 'art') — cada um precisa do proprio playhead, senao a
        // arte de uma pagina vaza para outra. _playheads[path] guarda so o
        // "ativo" (ultimo resolvido) para goto/currentFrame.
        const key = path + '' + tlId;
        let h = this._playheadAll.get(key);
        if (!h) {
            h = { tl, frame: 1, stopped: false, path, sid: tlId };
            // clips de idioma (letreiros): frames segmentados por idioma,
            // o script original faz gotoAndStop(language) — fixamos o frame
            const langs = ['english', 'portuguese', 'french', 'spanish'];
            if (langs.some((l) => tl.labels?.[l] !== undefined)) {
                h.frame = tl.labels[this.language] ?? tl.labels.english ?? 1;
                h.stopped = true;
                this._playheadAll.set(key, h);
                this._playheads.set(path, h);
                this._emitSounds(tl, h.frame, h); // som do frame inicial toca na entrada (Flash)
                return h;
            }
            // ações do frame inicial executam ao entrar (ex.: stop() no frame 1)
            for (const c of this._actions(tl, 1)) {
                if (c[0] === 'stop') h.stopped = true;
                else if (c[0] === 'gotoAndStop') {
                    const f = typeof c[1] === 'string' ? this._labelFrame(tl, c[1]) : Number(c[1]);
                    if (f) { h.frame = f; h.stopped = true; }
                }
            }
            this._playheadAll.set(key, h);
            this._emitSounds(tl, h.frame, h); // idem: frame inicial pode ter StartSound
        }
        this._playheads.set(path, h);
        return h;
    }

    _path(parent, entry) {
        if (entry.name) return parent ? `${parent}.${entry.name}` : entry.name;
        return `${parent}#${entry.depth}`;
    }

    // Roots de layer sujos por interacoes (hover/click) — merge no proximo tick.
    _markRoot(path) {
        const p = String(path);
        this._forcedDirty.add(p.split('.')[0]);
        this._forcedPaths.add(p);
    }

    // Estado de botao (up/over/down) — port do movie.set(path,{button}) do gp.
    setButtonState(path, state) {
        const prev = this._buttonStates.get(path) || 'up';
        if (prev === state) return;
        this._buttonStates.set(path, state);
        this._markRoot(path);
    }

    // gotoAndPlay/gotoAndStop num path arbitrario (hover actions do script).
    // Match exato ou sufixo ('dance_canopy_mc' acha 'background_mc.dance_canopy_mc').
    gotoPath(path, frame, playing = true) {
        let h = this._playheads.get(path);
        if (!h) {
            for (const [k, v] of this._playheads)
                if (k === path || k.endsWith('.' + path)) { h = v; break; }
        }
        if (!h) return false;
        const f = typeof frame === 'string' ? this._labelFrame(h.tl, frame) : Number(frame);
        if (!f) return false;
        const nf = Math.max(1, Math.min(f, h.tl.frames.length || 1));
        if (nf !== h.frame) this._emitSounds(h.tl, nf, h);
        h.frame = nf;
        h.stopped = !playing;
        this._markRoot(path);
        return true;
    }

    // Coleta botoes interativos (character kind='button') com bounds em coords
    // de mundo — port do refreshNavigation/hitMask do RoomDirector do gp.
    findButtons(frameIdx = 0) {
        const out = [];
        const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        const frame = this._mainTl.frames[frameIdx] || this._mainTl.frames[0] || [];
        const walk = (entries, matrix, path) => {
            for (const e of entries) {
                const childPath = this._path(path, e);
                const world = matMul(matrix, arrMat(e.matrix || [1, 0, 0, 1, 0, 0]));
                const sid = String(e.id);
                const sp = this.sprites[sid];
                if (sp) {
                    const h = this._playhead(childPath, sid);
                    const fr = h ? (h.tl.frames[h.frame - 1] || []) : [];
                    walk(fr, world, childPath);
                } else {
                    const ch = this.characters[sid];
                    if (ch?.kind === 'button') {
                        const rec = ch.records?.hittest || ch.records?.up || [];
                        const b = this._boundsOfEntries(rec, world, childPath);
                        if (b) out.push({ path: childPath, id: Number(e.id), name: e.name || childPath.split('.').pop(), bounds: b });
                    }
                }
            }
        };
        walk(frame, ID, '');
        return out;
    }

    // Renderiza uma lista de entries (um frame de timeline) no ctx.
    // matrix: matriz mundo acumulada; color: colorTransform acumulado.
    async _drawEntries(ctx, entries, matrix, path, color, scale, depth) {
        let i = 0;
        while (i < entries.length) {
            const e = entries[i];
            // mascara Flash: entries seguintes com depth <= clipDepth sao clipadas
            // pelo shape do entry (mesmo formato tratado em clip.js)
            if (e.clipDepth !== undefined) {
                const masked = [];
                while (i + 1 < entries.length && entries[i + 1].depth <= e.clipDepth)
                    masked.push(entries[++i]);
                await this._drawMasked(ctx, e, masked, matrix, path, color, scale, depth);
                i++;
                continue;
            }
            await this._drawEntry(ctx, e, matrix, path, color, scale, depth);
            i++;
        }
    }

    async _drawEntry(ctx, e, matrix, path, color, scale, depth) {
        const childPath = this._path(path, e);
        // sprites animados viram overlays proprios (RoomScene): a layer
        // estatica nao os desenha, senao o frame congelado "vazaria" por
        // tras do overlay animado
        if (this._skipDynamic?.has(childPath)) return;
        const st = this._state?.get(childPath);
        if (st?.visible === false) return;
        // state.matrix (set(path,{matrix})) substitui a matrix local do
        // entry — equivalente ao swl_transform do cliente gopenguin
        const local = st?.matrix ? arrMat(st.matrix) : arrMat(e.matrix || [1, 0, 0, 1, 0, 0]);
        const world = matMul(matrix, local);
        const sid = String(e.id);
        let entryColor = e.color ? colorMul(color, e.color) : color;
        if (st?.color) entryColor = colorMul(entryColor, st.color);
        if (this.sprites[sid]) {
            const h = this._playhead(childPath, sid);
            if (!h) return;
            const frame = h.tl.frames[h.frame - 1] || [];
            const grid = this.scalingGrids?.[sid];
            // scale9Grid do Flash (port do gp): as margens fora da grade
            // mantem tamanho fixo em device px; so a regiao central estica.
            if (grid && local.a > 0 && local.d > 0 && local.b === 0 && local.c === 0) {
                await this._drawNineSlice(ctx, frame, world, childPath, entryColor, scale, depth, grid, local);
                return;
            }
            await this._drawEntries(ctx, frame, world, childPath, entryColor, scale, depth + 1);
        } else {
            const ch = this.characters[sid];
            if (!ch) return;
            if (st?.text !== undefined && (ch.kind === 'text' || this.editTexts?.[sid])) {
                await this._drawEditText(ctx, ch, sid, world, entryColor, scale, st.text);
                return;
            }
            if (ch.kind === 'button') {
                const bs = this._buttonStates.get(childPath) || 'up';
                const rec = ch.records?.[bs] || ch.records?.up || [];
                await this._drawEntries(ctx, rec, world, childPath, entryColor, scale, depth + 1);
            } else if (ch.file) {
                await this._drawShape(ctx, ch, world, entryColor, scale);
            }
        }
    }

    // Port do scale9Grid do gp (drawEntry): b/v = limites das fatias no
    // espaco do simbolo; w/S = quanto da margem sobra (clamp 1 quando o
    // destino e menor que as margens); x/C = posicoes das linhas de grade no
    // espaco local (margens fixas em device px, centro absorve o stretch).
    // Cada fatia e desenhada com clip + transform local -> device.
    async _drawNineSlice(ctx, frame, world, path, color, scale, depth, grid, local) {
        const p = this._boundsOfEntries(frame, { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, path);
        if (!p) {
            await this._drawEntries(ctx, frame, world, path, color, scale, depth + 1);
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
        // fatia com clip fracionario e abria gap de ~1px nas emendas
        // (visivel no prompt_mc e demais paineis 9-slice).
        // Fonte de cada fatia = celula da GRADE (b/v) no render NAO-esticado
        // (parent = world * inv(local)); destino = celula x/C sob world
        // (com o stretch). Renderizar com world direto esticava as margens.
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
        // parent = world * inv(local): matrix do pai sem o transform da
        // instancia (local e axis-aligned: b=c=0, garantido pelo caller)
        const parent = matMul(world, {
            a: 1 / local.a, b: 0, c: 0, d: 1 / local.d,
            x: -local.x / local.a, y: -local.y / local.d,
        });
        // devRectM retorna [x, y, w, h] — nw/nh sao w/h, nao coords
        const [nx0, ny0, nw, nh] = devRectM(parent, p[0], p[1], p[2] - p[0], p[3] - p[1]);
        // L: supersample extra para a celula central, que no destino e
        // ampliada por local.a/local.d — sem isso o bitmap nativo (parent)
        // fica menos nitido que o render vetorial por fatia do algoritmo
        // original. Margens viram downscale (mais nitidas, sem custo
        // visual). Cap em 3 para nao explodir memoria em zooms extremos.
        const L = Math.min(3, Math.max(Math.abs(local.a), Math.abs(local.d), 1));
        const fw = Math.max(1, Math.ceil(nw * L)), fh = Math.max(1, Math.ceil(nh * L));
        const off = document.createElement('canvas');
        off.width = fw; off.height = fh;
        const octx = off.getContext('2d');
        const mOff = { a: parent.a * L, b: parent.b * L, c: parent.c * L, d: parent.d * L,
            x: (parent.x - nx0) * L, y: (parent.y - ny0) * L };
        await this._drawEntries(octx, frame, mOff, path, color, scale, depth + 1);
        for (let r = 0; r < 3; r++) {
            for (let cIdx = 0; cIdx < 3; cIdx++) {
                const P = x[cIdx + 1] - x[cIdx], I = C[r + 1] - C[r];
                if (P <= 0 || I <= 0 || b[cIdx + 1] === b[cIdx] || v[r + 1] === v[r]) continue;
                // src: celula da grade (b/v) no render nativo (mOff);
                // dst: celula de destino (x/C) sob world (com stretch)
                const s = devRectM(mOff, b[cIdx], v[r], b[cIdx + 1] - b[cIdx], v[r + 1] - v[r]);
                const d = devRectM(world, x[cIdx], C[r], P, I);
                if (s[2] <= 0 || s[3] <= 0 || d[2] <= 0 || d[3] <= 0) continue;
                ctx.drawImage(off, s[0], s[1], s[2], s[3], d[0], d[1], d[2], d[3]);
            }
        }
    }

    // Renderiza conteudo clipado por uma mascara vetorial (clipDepth).
    async _drawMasked(ctx, maskEntry, contentEntries, matrix, path, color, scale, depth) {
        const b = this._boundsOfEntries(contentEntries, matrix, path)
            || this._boundsOfEntries([maskEntry], matrix, path);
        if (!b) {
            for (const e of contentEntries)
                await this._drawEntry(ctx, e, matrix, path, color, scale, depth);
            return;
        }
        const pad = 4;
        // bounds ja estao em coords de device px (matrix inclui supersampling)
        const x0 = Math.floor(b[0] - pad), y0 = Math.floor(b[1] - pad);
        const cw = Math.max(1, Math.ceil(b[2] - b[0] + pad * 2));
        const ch = Math.max(1, Math.ceil(b[3] - b[1] + pad * 2));

        const content = document.createElement('canvas');
        content.width = cw; content.height = ch;
        const cctx = content.getContext('2d');
        cctx.setTransform(1, 0, 0, 1, -x0, -y0);
        for (const e of contentEntries)
            await this._drawEntries(cctx, [e], matrix, path, color, scale, depth);

        const mask = document.createElement('canvas');
        mask.width = cw; mask.height = ch;
        const mctx = mask.getContext('2d');
        mctx.setTransform(1, 0, 0, 1, -x0, -y0);
        // desenha so o shape da mascara (sem a semantica de clipDepth).
        // characters com maskFile usam esse arquivo como silhueta real
        // (port do gp: masking && b.maskFile ? b.maskFile : b.file)
        const mch = this.characters[String(maskEntry.id)];
        if (mch?.file) {
            const mw = matMul(matrix, arrMat(maskEntry.matrix || [1, 0, 0, 1, 0, 0]));
            await this._drawShape(mctx, mch, mw, IDENT_COLOR, scale, mch.maskFile || mch.file);
        } else {
            const me = { ...maskEntry };
            delete me.clipDepth;
            await this._drawEntry(mctx, me, matrix, path, IDENT_COLOR, scale, depth);
        }

        const debug = typeof window !== 'undefined' && window.__movieDebug;
        let prePx = 0;
        if (debug) {
            const d0 = cctx.getImageData(0, 0, cw, ch).data;
            for (let j = 3; j < d0.length; j += 4) if (d0[j] > 0) prePx++;
        }
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.globalCompositeOperation = 'destination-in';
        cctx.drawImage(mask, 0, 0);
        cctx.globalCompositeOperation = 'source-over';

        if (debug) {
            const count = (cv) => {
                const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
                let n = 0; for (let j = 3; j < d.length; j += 4) if (d[j] > 0) n++;
                return n;
            };
            (window.__maskStats = window.__maskStats || []).push({
                path, cw, ch, prePx, keptPx: count(content), maskPx: count(mask),
            });
        }

        // composita em coords de device px (bounds absolutos); drawImage sem
        // dw/dh usa o tamanho intrinseco do canvas auxiliar
        ctx.drawImage(content, x0, y0);
    }

    // bounds [x0,y0,x1,y1] em coords de mundo para uma lista de entries
    _boundsOfEntries(entries, matrix, path) {
        let b = null;
        for (const e of entries) {
            const eb = this._entryBounds(e, matrix, path);
            if (!eb) continue;
            b = b ? [Math.min(b[0], eb[0]), Math.min(b[1], eb[1]), Math.max(b[2], eb[2]), Math.max(b[3], eb[3])] : eb;
        }
        return b;
    }

    _entryBounds(e, matrix, path) {
        const childPath = this._path(path, e);
        const st = this._state?.get(childPath);
        let local = st?.matrix ? arrMat(st.matrix) : arrMat(e.matrix || [1, 0, 0, 1, 0, 0]);
        const world = matMul(matrix, local);
        const sid = String(e.id);
        const sp = this.sprites[sid];
        local = null;
        if (sp) {
            const h = this._playhead(childPath, sid);
            if (!h) return null;
            const frame = h.tl.frames[h.frame - 1] || [];
            return this._boundsOfEntries(frame, world, childPath);
        }
        const ch = this.characters[sid];
        if (!ch) return null;
        if (ch.file) {
            const cw = ch.size?.[0] ?? 0, chh = ch.size?.[1] ?? 0;
            const ox = ch.origin?.[0] ?? 0, oy = ch.origin?.[1] ?? 0;
            local = [-ox, -oy, cw - ox, chh - oy];
        } else if (ch.kind === 'button') {
            // bounds visuais = uniao dos records up/over/down — o hittest
            // e so a area clicavel e pode ser menor/deslocado da arte
            // (ex.: dance_btn da town: hittest 49x71 mas a porta+DISCO
            // ocupam ~66x72 world — overlay saía com canvas errado e a
            // porta inteira ficava invisivel)
            let bb = null;
            for (const st of ['up', 'over', 'down']) {
                const rec = ch.records?.[st];
                if (!rec?.length) continue;
                const rb = this._boundsOfEntries(rec, world, childPath);
                if (rb) bb = bb ? [Math.min(bb[0], rb[0]), Math.min(bb[1], rb[1]), Math.max(bb[2], rb[2]), Math.max(bb[3], rb[3])] : rb;
            }
            if (bb) return bb;
            // records.up/over podem ser [] (botoes so com hittest, ex.:
            // collectCoins do Ice Fishing) — [] e truthy, entao o fallback
            // precisa testar .length ou o hittest nunca e alcancado.
            const rec = ch.records?.up?.length ? ch.records.up
                : ch.records?.over?.length ? ch.records.over
                : ch.records?.hittest || [];
            return this._boundsOfEntries(rec, world, childPath);
        }
        if (!local) return null;
        const pts = [[local[0], local[1]], [local[2], local[1]], [local[0], local[3]], [local[2], local[3]]]
            .map(([x, y]) => [world.a * x + world.c * y + world.x, world.b * x + world.d * y + world.y]);
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }

    async _drawShape(ctx, ch, world, color, scale, file = ch.file) {
        const tint = !colorIdentity(color);
        // escala efetiva: world pode ampliar o shape (poses de acao 2-4x);
        // rasterizar em scale*|world| evita upscale pixelado do bitmap
        const k = Math.max(Math.hypot(world.a, world.b), Math.hypot(world.c, world.d), 1e-6);
        // artFlatScale (catalogo): rasteriza sempre em `scale` — sprites
        // aninhados escalados pediriam eff=scale*k em dezenas de valores
        // continuos, gerando ~200 misses seriais por pagina densa (p17 =
        // 13s). Com scale fixo o warm cobre 100% dos shapes; o custo e um
        // leve suavizacao nos poucos shapes ampliados (como o gopenguin,
        // que rasteriza tudo a 1x).
        const eff = this.artFlatScale ? scale : +(scale * Math.min(k, 8)).toFixed(3);
        const canvas = tint
            ? await this.tintedCanvas(file, ch, color, eff)
            : await this.artCanvas(file, ch, eff);
        if (!canvas) return;
        // mesmo fallback do artCanvas: size 0 (shape degenerado) usa o
        // tamanho real do bitmap — drawImage com w=0 nao renderiza nada.
        const w = ch.size?.[0] || canvas.width / eff;
        const h = ch.size?.[1] || canvas.height / eff;
        const ox = ch.origin?.[0] ?? 0;
        const oy = ch.origin?.[1] ?? 0;
        ctx.save();
        ctx.transform(world.a, world.b, world.c, world.d, world.x, world.y);
        // canvas ja esta em resolucao de dispositivo (w*scale px); o transform
        // world inclui scale — desenha em unidades de mundo (1:1 texel:pixel)
        ctx.drawImage(canvas, -ox, -oy, w, h);
        ctx.restore();
    }

    // Top-level: divide o frame principal em camadas (1 por entry).
    // depthOf() portado do cliente web (gp-index.js): background_mc e entries
    // que nao sao sprites usam e.depth; sprites usam floor(x)+1000*floor(y);
    // foreground_mc fixo em 900001.
    _depthOf(e) {
        if (e.name === 'foreground_mc') return 900001;
        if (e.name === 'background_mc' || !this.sprites[String(e.id)]) return e.depth ?? 0;
        const t = e.matrix?.[4] ?? 0, s = e.matrix?.[5] ?? 0;
        return t > 0 && s > 0 ? Math.floor(t) + 1000 * Math.floor(s) : (e.depth ?? 0);
    }

    topLevelLayers() {
        const frame = this._mainTl.frames[0] || [];
        const SKIP = new Set(['block_mc', 'triggers_mc']);
        return frame
            .filter((e) => !SKIP.has(e.name))
            .map((e) => ({ entry: e, z: this._depthOf(e) }))
            .sort((a, b) => a.z - b.z);
    }

    // Cria playheads de todos os sprites do movie SEM rasterizar nada.
    // Necessario no cache-hit do IndexedDB: sem um renderLayer inicial,
    // nenhum playhead existia -> tick() nunca marcava layers sujas ->
    // animacao das salas ficava congelada (so na 1a visita, sem cache).
    warmPlayheads() {
        const frame = this._mainTl.frames[0] || [];
        const SKIP = new Set(['block_mc', 'triggers_mc']);
        for (const e of frame) {
            if (SKIP.has(e.name)) continue;
            this._walkEntry(e, '');
        }
    }

    _walkEntry(e, path) {
        const childPath = this._path(path, e);
        const sid = String(e.id);
        if (this.sprites[sid]) {
            const h = this._playhead(childPath, sid);
            if (h) this._walkEntries(h.tl.frames[h.frame - 1] || [], childPath);
        } else {
            const ch = this.characters[sid];
            if (ch?.kind === 'button') this._walkEntries(ch.records?.up ?? [], childPath);
        }
    }

    _walkEntries(entries, path) {
        for (const e of entries) this._walkEntry(e, path);
    }

    // Renderiza o subtree de um top-level entry para um canvas w*h (px de dispositivo).
    // parentMatrix: matriz acumulada do pai (ex.: triggers_mc) — default identidade.
    async renderLayer(entry, canvas, scale, parentMatrix) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // coordenadas de mundo escaladas: world * scale
        const base = matMul({ a: scale, b: 0, c: 0, d: scale, x: 0, y: 0 },
            arrMat(parentMatrix || [1, 0, 0, 1, 0, 0]));
        const world = matMul(base, arrMat(entry.matrix || [1, 0, 0, 1, 0, 0]));
        const sid = String(entry.id);
        const path = this._path('', entry);
        if (this.sprites[sid]) {
            const h = this._playhead(path, sid);
            if (h) {
                const frame = h.tl.frames[h.frame - 1] || [];
                await this._drawEntries(ctx, frame, world, path, IDENT_COLOR, scale, 1);
            }
        } else {
            const ch = this.characters[sid];
            if (ch?.kind === 'button') {
                const st = this._buttonStates.get(path) || 'up';
                const rec = ch.records?.[st] || ch.records?.up || [];
                await this._drawEntries(ctx, rec, world, path, IDENT_COLOR, scale, 1);
            } else if (ch?.file) {
                await this._drawShape(ctx, ch, world, IDENT_COLOR, scale);
            }
        }
    }

    // ---------- Sprites animados como overlays (RoomScene) ----------
    // Em vez de re-renderizar a layer inteira a cada tick, cada sprite
    // animado (frames>1) com ancestrais estaticos vira um overlay com
    // canvas/textura proprios — a layer fica estatica (renderiza 1x).
    // collectDynamics varre as entries acumulando matrizes e paths.

    collectDynamics(entries, matrix, path, out, masked = false) {
        let i = 0;
        while (i < entries.length) {
            const e = entries[i];
            // clipDepth: entries seguintes clipadas — dynamics dentro de
            // mascara nao podem virar overlay (perderiam o recorte)
            const maskedList = [];
            if (e.clipDepth !== undefined) {
                while (i + 1 < entries.length && entries[i + 1].depth <= e.clipDepth)
                    maskedList.push(entries[++i]);
            }
            this._collectDynEntry(e, matrix, path, out, masked);
            for (const me of maskedList) this._collectDynEntry(me, matrix, path, out, true);
            i++;
        }
    }

    _collectDynEntry(e, matrix, path, out, masked) {
        const childPath = this._path(path, e);
        const world = matMul(matrix, arrMat(e.matrix || [1, 0, 0, 1, 0, 0]));
        const sid = String(e.id);
        if (this.sprites[sid]) {
            const tl = this.sprites[sid];
            const frames = tl.frames?.length || 1;
            if (frames > 1 && !masked) {
                out.push({ path: childPath, sid, world, entry: e });
                return; // nao desce — o overlay renderiza o subtree inteiro
            }
            this.collectDynamics(tl.frames[0] || [], world, childPath, out, masked);
            return;
        }
        const ch = this.characters[sid];
        if (ch?.kind === 'button') {
            // dynamics dentro de records de botao nao viram overlay: o
            // estado up/over/down muda a matrix/arte e a layer re-renderiza
            // no forced dirty — hoistar congelaria o estado errado
            this.collectDynamics(ch.records?.up || [], world, childPath, out, true);
        }
    }

    // ---------- Segmentacao de layer (z-order fiel ao Flash) ----------
    // collectItems varre o subtree de uma top-level layer na ORDEM DE
    // DESENHO e emite ops: {type:'static', entries, matrix, path, color}
    // (subarvores sem animacao — agrupadas em segmentos) e
    // {type:'dyn', dyn} (sprites frames>1 — overlays). Grupos clipDepth
    // sao atomicos: a mascara precisa do clip entry + followers juntos.

    collectItems(entry) {
        const out = [];
        const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        this._walkItems([entry], ID, '', IDENT_COLOR, out);
        return out;
    }

    _walkItems(entries, matrix, path, color, out) {
        let i = 0;
        while (i < entries.length) {
            const e = entries[i];
            if (e.clipDepth !== undefined) {
                const group = [e];
                while (i + 1 < entries.length && entries[i + 1].depth <= e.clipDepth)
                    group.push(entries[++i]);
                out.push({ type: 'static', entries: group, matrix, path, color });
                i++;
                continue;
            }
            this._emitItem(e, matrix, path, color, out);
            i++;
        }
    }

    _emitItem(e, matrix, path, color, out) {
        const childPath = this._path(path, e);
        const sid = String(e.id);
        const entryColor = e.color ? colorMul(color, e.color) : color;
        const local = arrMat(e.matrix || [1, 0, 0, 1, 0, 0]);
        if (this.sprites[sid]) {
            const tl = this.sprites[sid];
            if ((tl.frames?.length || 1) > 1) {
                out.push({ type: 'dyn', dyn: {
                    path: childPath, sid, world: matMul(matrix, local), entry: e,
                    // contexto do pai — se o overlay falhar (bounds invalidos)
                    // o item pode virar op estatico na posicao correta
                    parentMatrix: matrix, parentPath: path, parentColor: color,
                } });
                return;
            }
            if (this._entriesHaveDynamic(tl.frames[0] || [])) {
                this._walkItems(tl.frames[0] || [], matMul(matrix, local), childPath, entryColor, out);
                return;
            }
            out.push({ type: 'static', entries: [e], matrix, path, color });
            return;
        }
        const ch = this.characters[sid];
        if (ch?.kind === 'button' && this._entriesHaveDynamic(ch.records?.up || [])) {
            this._walkItems(ch.records?.up || [], matMul(matrix, local), childPath, entryColor, out);
            return;
        }
        out.push({ type: 'static', entries: [e], matrix, path, color });
    }

    // A subarvore contem sprite animado (frames>1) que viraria overlay?
    // Grupos clipDepth nao contam: sao atomicos e ficam estaticos.
    _entriesHaveDynamic(entries) {
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (e.clipDepth !== undefined) {
                while (i + 1 < entries.length && entries[i + 1].depth <= e.clipDepth) i++;
                continue;
            }
            if (this._subtreeHasDynamic(e)) return true;
        }
        return false;
    }

    _subtreeHasDynamic(e) {
        const sid = String(e.id);
        if (this.sprites[sid]) {
            const tl = this.sprites[sid];
            if ((tl.frames?.length || 1) > 1) return true;
            return this._entriesHaveDynamic(tl.frames[0] || []);
        }
        const ch = this.characters[sid];
        if (ch?.kind === 'button') return this._entriesHaveDynamic(ch.records?.up || []);
        return false;
    }

    // Todos os paths descendentes de uma lista de entries (todas as frames
    // de sprites e todos os records de botoes) — usado para saber qual
    // segmento re-renderizar quando um playhead/botao fica sujo.
    collectPaths(entries, path, out) {
        for (const e of entries) {
            const cp = this._path(path, e);
            out.add(cp);
            const sid = String(e.id);
            if (this.sprites[sid]) {
                for (const fr of this.sprites[sid].frames || []) this.collectPaths(fr, cp, out);
            } else {
                const ch = this.characters[sid];
                if (ch?.kind === 'button') {
                    for (const k of Object.keys(ch.records || {}))
                        this.collectPaths(ch.records[k] || [], cp, out);
                }
            }
        }
    }

    // Bounds [x0,y0,x1,y1] em DEVICE px, uniao de todos os frames do sprite
    // (o canvas do overlay precisa cobrir a animacao inteira, nao so o
    // frame atual). worldDev = scale * dyn.world.
    dynBounds(dyn, scale) {
        const h = this._playhead(dyn.path, dyn.sid);
        if (!h) return null;
        const sm = { a: scale, b: 0, c: 0, d: scale, x: 0, y: 0 };
        const worldDev = matMul(sm, dyn.world);
        let b = null;
        for (const fr of h.tl.frames) {
            const fb = this._boundsOfEntries(fr, worldDev, dyn.path);
            if (!fb) continue;
            b = b ? [Math.min(b[0], fb[0]), Math.min(b[1], fb[1]), Math.max(b[2], fb[2]), Math.max(b[3], fb[3])] : fb;
        }
        return b;
    }

    // Re-renderiza o frame atual do sprite dinamico no canvas do overlay.
    // dyn.ox/oy = origem do canvas em device px (translate compoe com o
    // worldDev de cada shape via ctx.transform).
    async renderSpriteDynamic(dyn, scale) {
        const h = this._playhead(dyn.path, dyn.sid);
        if (!h || !dyn.canvas) return;
        const frame = h.tl.frames[h.frame - 1] || [];
        const sm = { a: scale, b: 0, c: 0, d: scale, x: 0, y: 0 };
        const worldDev = matMul(sm, dyn.world);
        const ctx = dyn.canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, dyn.canvas.width, dyn.canvas.height);
        ctx.translate(-dyn.ox, -dyn.oy);
        await this._drawEntries(ctx, frame, worldDev, dyn.path, IDENT_COLOR, scale, 1);
    }

    // ---------- Estado por path (port do Clip.set/goto/currentFrame/find do gp) ----------
    // Usado por catalogos/games: 'book' e a timeline principal; paths relativos
    // 'book.a.b' sao normalizados para 'a.b' (nossos playheads nao tem prefixo).

    _normalizePath(path) {
        let p = String(path || '');
        if (p === 'book') return '';
        if (p.startsWith('book.')) return p.slice(5);
        if (p.startsWith('book#')) return p.slice(4);
        return p;
    }

    // Resolve um path dot-notation para {entry, path, id} no estado atual.
    // Segmentos: nome do entry ou '#<depth>' para entries sem nome.
    _resolve(path) {
        const segs = this._normalizePath(path).split('.').filter(Boolean);
        if (!segs.length) return { entry: { id: '__main__', name: 'book' }, path: '', id: '__main__', main: true };
        let entries = this._mainTl.frames[this._mainFrame - 1] || this._mainTl.frames[0] || [];
        let parent = '';
        let parentPath = '';
        let parentMatrix = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        let world = parentMatrix;
        let e = null;
        for (const seg of segs) {
            e = null;
            for (const cand of entries) {
                const nm = cand.name ? (parent ? parent + '.' + cand.name : cand.name)
                                     : (parent ? parent + '#' + cand.depth : '#' + cand.depth);
                const last = nm.split('.').pop();
                if ((cand.name && (cand.name === seg || last === seg)) ||
                    (!cand.name && (seg === '#' + cand.depth || last === seg))) { e = cand; break; }
            }
            if (!e) return null;
            const childPath = e.name ? (parent ? parent + '.' + e.name : e.name)
                                     : (parent ? parent + '#' + e.depth : '#' + e.depth);
            const st = this._state?.get(childPath);
            const local = st?.matrix ? arrMat(st.matrix) : arrMat(e.matrix || [1, 0, 0, 1, 0, 0]);
            parentPath = parent;
            parentMatrix = world;
            world = matMul(world, local);
            parent = childPath;
            const sid = String(e.id);
            if (this.sprites[sid]) {
                const h = this._playhead(parent, sid);
                entries = h ? (h.tl.frames[h.frame - 1] || []) : [];
            } else {
                entries = [];
            }
        }
        return e ? { entry: e, path: parent, id: String(e.id), parentPath, parentMatrix, matrix: world } : null;
    }

    find(path) { return this._resolve(path); }

    goto(path, frame, playing = false) {
        const p = this._normalizePath(path);
        const f = typeof frame === 'string' ? this._labelFrame(this._mainTl, frame) : Number(frame);
        if (p === '') {
            if (!f) return false;
            const nf = Math.max(1, Math.min(f, this._mainTl.frames.length || 1));
            if (nf !== this._mainFrame) this._emitSounds(this._mainTl, nf);
            this._mainFrame = nf;
            this._dirty = true;
            this._markRoot('');
            return true;
        }
        const r = this._resolve(p);
        if (!r || r.main || !this.sprites[r.id]) return false;
        const ff = typeof frame === 'string' ? this._labelFrame(this.sprites[r.id], frame) : f;
        if (!ff) return false;
        let h = this._playheads.get(r.path);
        if (!h) h = this._playhead(r.path, r.id);
        if (!h) return false;
        const nf = Math.max(1, Math.min(ff, h.tl.frames.length || 1));
        if (nf !== h.frame) this._emitSounds(h.tl, nf, h);
        h.frame = nf;
        h.stopped = !playing;
        this._markRoot(r.path);
        return true;
    }

    // Sons de timeline do SWF (StartSound): tl.sounds = [{frame, ids, starts}].
    // Enfileira os ids dos sons do frame "entrado" — quem consome (ex.:
    // IceFishingGame) mapeia id -> arquivo e toca. drainSounds() esvazia.
    _emitSounds(tl, frame, h) {
        const list = tl?.sounds;
        if (!list?.length || !this._sndQueue || h?.muted) return;
        for (const s of list)
            if (s.frame === frame)
                for (const id of s.ids || []) this._sndQueue.push(id);
    }

    drainSounds() {
        const q = this._sndQueue || [];
        this._sndQueue = [];
        return q;
    }

    currentFrame(path) {
        const p = this._normalizePath(path);
        if (p === '') return this._mainFrame;
        let h = this._playheads.get(p);
        if (!h) {
            for (const [k, v] of this._playheads)
                if (k === p || k.endsWith('.' + p)) { h = v; break; }
        }
        return h ? h.frame : 1;
    }

    // Pose ao vivo de um path: {frame, id, path, matrix(mundo), bounds}.
    // Resolvido contra os playheads atuais — equivalente ao swl_pose do
    // cliente gopenguin. Usado por minigames que dirigem o movie
    // (ex.: Ice Fishing faz hit-test de hotspots).
    pose(path) {
        const r = this._resolve(path);
        if (!r || r.main) return null;
        let frame = 1;
        if (this.sprites[r.id]) {
            const h = this._playhead(r.path, r.id);
            frame = h ? h.frame : 1;
        }
        const bounds = this._entryBounds(r.entry, r.parentMatrix, r.parentPath);
        return { frame, id: r.id, path: r.path, matrix: r.matrix, bounds };
    }

    set(path, props = {}) {
        const p = this._normalizePath(path);
        const prev = this._state.get(p) || {};
        this._state.set(p, { ...prev, ...props });
        if (props.text !== undefined && !prev.entryId) {
            const r = this._resolve(p);
            if (r && !r.main) this._state.get(p).entryId = r.id;
        }
        this._markRoot(p);
    }

    getState(path) { return this._state.get(this._normalizePath(path)); }

    frameCount() { return this._mainTl.frames.length || 1; }

    // Carrega as fontes TTF declaradas em timelines.json.fonts (editTexts).
    async ensureFonts() {
        for (const [id, meta] of Object.entries(this.fonts || {})) {
            if (!meta?.file) continue;
            const fam = `gpf-${id}`;
            try {
                if (!document.fonts.check(`12px ${fam}`)) {
                    const f = new FontFace(fam, `url(${this.base}/chars/${meta.file})`);
                    const loaded = await f.load();
                    document.fonts.add(loaded);
                }
            } catch (e) { console.warn('[movie] font falhou', id, meta.file, e); }
        }
    }

    async _fontFamily(fontId) {
        if (fontId == null) return 'sans-serif';
        const fam = `gpf-${fontId}`;
        if (!this._fontCache.has(fontId)) {
            this._fontCache.set(fontId, this.ensureFonts().then(() => fam));
        }
        return this._fontCache.get(fontId);
    }

    // Renderiza texto dinamico (editTexts) com a fonte do SWF — substitui o
    // SVG pre-renderizado quando set(path,{text}) foi usado (ex.: coins_txt).
    async _drawEditText(ctx, ch, sid, world, color, scale, text) {
        const ed = this.editTexts?.[sid];
        if (!ed) return this._drawShape(ctx, ch, world, color, scale);
        const fam = await this._fontFamily(ed.font);
        const meta = ed.font != null ? this.fonts?.[ed.font] : null;
        const [bx0, by0, bx1, by1] = ed.bounds || [0, 0, ch.size?.[0] ?? 100, ch.size?.[1] ?? 20];
        ctx.save();
        ctx.transform(world.a, world.b, world.c, world.d, world.x, world.y);
        const size = ed.size ?? 16;
        ctx.font = `${meta?.bold ? 'bold ' : ''}${meta?.italic ? 'italic ' : ''}${size}px ${fam}, sans-serif`;
        ctx.textAlign = ed.align === 'center' ? 'center' : ed.align === 'right' ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        const x = ed.align === 'center' ? (bx0 + bx1) / 2 : ed.align === 'right' ? bx1 : bx0;
        const y = (by0 + by1) / 2;
        const paint = (t, py) => {
            if (ed.outlines) {
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.lineWidth = Math.max(0.5, size * 0.07);
                ctx.lineJoin = 'round';
                ctx.strokeText(t, x, py);
            }
            ctx.fillStyle = ed.color || '#000000';
            ctx.fillText(t, x, py);
        };
        // wordWrap/multiline (ex.: message_txt do prompt_mc): quebra o texto
        // na largura do bounds e centraliza o bloco verticalmente
        if (ed.multiline || ed.wordWrap || String(text).includes('\n')) {
            const maxW = Math.max(10, bx1 - bx0);
            const lines = [];
            for (const para of String(text).split('\n')) {
                let line = '';
                for (const w of para.split(' ')) {
                    const t = line ? `${line} ${w}` : w;
                    if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; }
                    else line = t;
                }
                lines.push(line);
            }
            const lh = size * 1.3;
            const y0 = y - ((lines.length - 1) * lh) / 2;
            lines.forEach((ln, i) => paint(ln, y0 + i * lh));
        } else {
            paint(text, y);
        }
        ctx.restore();
    }

    // Coleta entries interativas (buttonActions + onRelease dos frame actions)
    // com bounds em coords de mundo — port do walk de render() do xo (catalogo).
    collectInteractive() {
        const out = { entries: [], handlers: [], nodes: new Map() };
        const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        const scanActions = (tl, frame, path) => {
            const a = tl.actions?.[frame] ?? tl.actions?.[String(frame)];
            const src = a && !Array.isArray(a) ? (a.source ?? '') : (typeof a === 'string' ? a : '');
            if (!src) return;
            for (const m of src.matchAll(/([\w.]+)\.onRelease\s*=\s*function\s*\(\)\s*\{([^{}]*)\}/g))
                out.handlers.push({ path: this._joinPath(path, m[1]), body: m[2], base: path });
        };
        const walk = (tl, entries, matrix, path, frame) => {
            scanActions(tl, frame, path);
            for (const e of entries) {
                const childPath = this._path(path, e);
                if (this._state?.get(childPath)?.visible === false) continue;
                const world = matMul(matrix, arrMat(e.matrix || ID));
                const sid = String(e.id);
                const acts = this.data.buttonActions?.[e.id];
                const isBtn = this.characters[sid]?.kind === 'button';
                if ((acts && (acts.release || acts.rollOver)) || isBtn || e.name) {
                    // _entryBounds aplica e.matrix internamente — passar a
                    // matriz do PAI (world ja inclui e.matrix = transform dupla)
                    const b = this._boundsOfEntries([e], matrix, path);
                    if (b) out.entries.push({
                        path: childPath, id: Number(e.id), entry: e, base: path,
                        name: e.name || childPath.split('.').pop(),
                        bounds: b, acts,
                    });
                }
                out.nodes.set(childPath, { entry: e, matrix, parent: path });
                const sp = this.sprites[sid];
                if (sp) {
                    const h = this._playhead(childPath, sid);
                    const fr = h ? (h.tl.frames[h.frame - 1] || []) : [];
                    walk(sp, fr, world, childPath, h ? h.frame : 1);
                }
            }
        };
        const frame = this._mainTl.frames[this._mainFrame - 1] || this._mainTl.frames[0] || [];
        walk(this._mainTl, frame, ID, '', this._mainFrame);
        this._nodes = out.nodes;
        return out;
    }

    _joinPath(parent, name) {
        if (!parent) return name;
        return parent + '.' + name;
    }

    // bounds [x0,y0,x1,y1] em coords de mundo para um path ja resolvido.
    boundsFor(path) {
        const p = this._normalizePath(path);
        const node = this._nodes?.get(p);
        if (!node) return null;
        return this._entryBounds(node.entry, node.matrix, node.parent ?? '');
    }

    // Renderiza o frame atual da timeline principal inteira
    // (catalogos: "paginas" sao frames do main). Respeita presenca por frame
    // e overrides de estado (visible/text) via set().
    // offX/offY: translacao em unidades de mundo aplicada antes do scale
    // (permite renderizar regiao arbitraria do stage — ex.: icones cujo
    // conteudo e centrado na origem e nao no stage 100x100)
    async renderFrame(frameIdx, canvas, scale, offX = 0, offY = 0) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const base = { a: scale, b: 0, c: 0, d: scale, x: offX * scale, y: offY * scale };
        const idx = frameIdx ?? (this._mainFrame - 1);
        const entries = this._mainTl.frames[idx] || [];
        await this._drawEntries(ctx, entries, base, '', IDENT_COLOR, scale, 1);
    }

    // ---------- Colisao e saidas entre salas ----------
    // Port do Room.block/triggers + findPath/isPositionValid/triggerAt do
    // cliente web: block_mc = areas bloqueadas, triggers_mc.<nome>_mc = zonas
    // de saida (sendJoinRoom parseado em this.exits).

    _alphaGrid(canvas) {
        const ctx = canvas.getContext('2d');
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const grid = new Uint8Array(canvas.width * canvas.height);
        for (let i = 0, j = 3; i < grid.length; i++, j += 4) grid[i] = d[j] > 8 ? 1 : 0;
        return { data: grid, w: canvas.width, h: canvas.height };
    }

    _gridHit(grid, x, y, scale) {
        const gx = Math.round(x * scale), gy = Math.round(y * scale);
        if (gx < 0 || gy < 0 || gx >= grid.w || gy >= grid.h) return false;
        return grid.data[gy * grid.w + gx] === 1;
    }

    // Rasteriza block_mc e os triggers de saida. Chamar apos setScale().
    async buildCollision(scale) {
        const W = this.stage.width || 760, H = this.stage.height || 480;
        const cw = Math.round(W * scale), ch = Math.round(H * scale);
        const frame = this._mainTl.frames[0] || [];
        this._colScale = scale;
        this._block = null;
        this._triggers = [];

        const blockEntry = frame.find((e) => e.name === 'block_mc');
        if (blockEntry) {
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            await this.renderLayer(blockEntry, canvas, scale);
            this._block = this._alphaGrid(canvas);
        }

        const trigEntry = frame.find((e) => e.name === 'triggers_mc');
        if (trigEntry) {
            const sid = String(trigEntry.id);
            const sp = this.sprites[sid];
            const h = sp && this._playhead(this._path('', trigEntry), sid);
            const sub = h ? (h.tl.frames[h.frame - 1] || []) : [];
            for (const e of sub) {
                const ex = e.name && this.exits[e.name];
                const tc = e.name && this.interactions?.trigContent?.[e.name];
                const tg = e.name && this.interactions?.trigGame?.[e.name];
                const tt = e.name && this.interactions?.trigTable?.[e.name];
                if (!ex && !tc && !tg && !tt) continue;
                const canvas = document.createElement('canvas');
                canvas.width = cw; canvas.height = ch;
                await this.renderLayer(e, canvas, scale, trigEntry.matrix);
                this._triggers.push({
                    name: e.name,
                    ...(ex || { room: null, x: 0, y: 0 }),
                    ...(tc ? { content: tc } : {}),
                    ...(tg ? { game: tg } : {}),
                    ...(tt ? { table: tt } : {}),
                    grid: this._alphaGrid(canvas),
                });
            }
        }
    }

    hitBlock(x, y) {
        return this._block ? this._gridHit(this._block, x, y, this._colScale) : false;
    }

    // isPositionValid + findPath do web: anda em linha reta ate o alvo,
    // parando antes da primeira area bloqueada/borda invalida.
    findPath(sx, sy, tx, ty) {
        const valid = (x, y) =>
            x >= 20 && x <= 740 && y >= 20 && y <= 430 && !this.hitBlock(x, y);
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.hypot(dx, dy);
        const n = Math.max(1, Math.ceil(dist / 2));
        let lx = sx, ly = sy;
        for (let i = 1; i <= n; i++) {
            const x = sx + (dx * i) / n, y = sy + (dy * i) / n;
            if (!valid(x, y)) break;
            lx = x; ly = y;
        }
        return { x: Math.round(lx), y: Math.round(ly) };
    }

    // triggerAt: retorna a saida {room,x,y} se (x,y) estiver numa zona de saida.
    triggerAt(x, y) {
        for (const t of this._triggers || []) {
            if (this._gridHit(t.grid, x, y, this._colScale))
                return { room: t.room, x: t.x, y: t.y, content: t.content, game: t.game, table: t.table };
        }
        return null;
    }

    // isValidSpawn: posição acessível (não bloqueada, não em saída, dentro dos limites)
    isValidSpawn(x, y) {
        if (x < 20 || x > 740 || y < 20 || y > 430) return false;
        if (this.hitBlock(x, y)) return false;
        if (this.triggerAt(x, y)) return false; // não spawnar em zona de saída
        return true;
    }

    // findSafeSpawn: busca uma posição válida próxima ao ponto desejado.
    // Tenta o ponto exato, depois expande em espiral até achar posição válida.
    findSafeSpawn(x, y) {
        if (this.isValidSpawn(x, y)) return { x, y };
        // espiral: tenta posições ao redor do ponto desejado
        const offsets = [
            [0, 40], [0, -40], [40, 0], [-40, 0],
            [30, 30], [-30, 30], [30, -30], [-30, -30],
            [60, 0], [-60, 0], [0, 60], [0, -60],
            [80, 40], [-80, 40], [80, -40], [-80, -40],
            [120, 0], [-120, 0], [0, 120], [0, -120],
        ];
        for (const [dx, dy] of offsets) {
            const nx = x + dx, ny = y + dy;
            if (this.isValidSpawn(nx, ny)) return { x: nx, y: ny };
        }
        // fallback: centro da sala (mais provável de ser válido)
        const cx = this.stage?.width ? this.stage.width / 2 : 380;
        const cy = this.stage?.height ? this.stage.height * 0.65 : 312;
        if (this.isValidSpawn(cx, cy)) return { x: cx, y: cy };
        // último recurso: varre a sala procurando qualquer posição válida
        for (let gy = 40; gy < 440; gy += 20) {
            for (let gx = 40; gx < 720; gx += 20) {
                if (this.isValidSpawn(gx, gy)) return { x: gx, y: gy };
            }
        }
        return { x: cx, y: cy }; // fallback final
    }
}
