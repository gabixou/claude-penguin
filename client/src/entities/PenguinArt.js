// PenguinArt.js — pinguim vetorial do GoPenguin (/swf/penguin/ + clothing/sprites).
// Porta a logica da classe `bi` (Penguin) do cliente web:
//   - art = Clip da timeline principal (76 frames = poses/acoes)
//   - animationFrame = fh(look, frame) — "secret frames" por roupa equipada
//   - itens de roupa = Clips de /assets/clothing/<id>/, desenhados na ordem De
//   - cor do corpo via colorTransform solido (ve()): mult=0, add=rgb

import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';

// Ordem de desenho dos itens (De no gp.js)
export const ITEM_DRAW_ORDER = ['feet', 'body', 'neck', 'hand', 'face', 'head'];
// Assinatura do look para penguin_action_frames (vr no gp.js)
const VR = ['head', 'face', 'neck', 'body', 'hand', 'feet'];

export const veColor = (rgb) => ({
    mult: [0, 0, 0, 1],
    add: [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 0],
});

// Fila de warm-up de SVGs: os packs do pinguim/roupas so comecam a decodificar
// quando a sala termina de carregar (RoomScene chama startWarm() no reveal).
// Sem isso os ~1800 SVGs do pack base + packs de roupa competiam com o
// renderLayer da sala e triplicavam o tempo de load.
const warmQueue = [];
let warmStarted = false;
const warmSvgs = (movie, chunk = 0) => {
    if (!movie?.prefetchSvgs) return;
    if (warmStarted) movie.prefetchSvgs(chunk);
    else warmQueue.push([movie, chunk]);
};

export class PenguinLibrary {
    // Dispara o warm-up pendente (idempotente). Chamado pela cena quando a
    // sala esta pronta — a partir dai itens/poses novas nao tem pop-in.
    static startWarm() {
        if (warmStarted) return;
        warmStarted = true;
        for (const [movie, chunk] of warmQueue.splice(0)) movie.prefetchSvgs(chunk);
    }

    static async load(base = '/assets/movies/penguin') {
        const lib = new PenguinLibrary();
        lib.base = base;
        lib.movie = await MovieRoom.load(base);
        lib.movie.setScale(1);
        lib.actionData = await fetch('/assets/penguin-action-frames.json')
            .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
        // dh: actionFrame -> Map("head,face,neck,body,hand,feet" -> secret_frame)
        lib.dh = new Map();
        for (const [frame, list] of Object.entries(lib.actionData)) {
            const m = new Map();
            for (const t of list || []) {
                const sig = VR.map((o) => t[o] ?? 0).join(',');
                m.set(sig, t.secret_frame);
            }
            lib.dh.set(Number(frame), m);
        }
        lib.items = new Map();      // itemId -> Promise<Clip|null>
        lib.bounds = lib._unionBounds();
        // bounds "firmes" (so +4) p/ hit-test de clique — a margem de
        // render nao deve inflar a area que abre o player card
        lib.hitBounds = { ...lib.bounds };
        const t = 12; // diferença entre margem de render (16) e a firme
        lib.hitBounds.x0 += t; lib.hitBounds.y0 += t;
        lib.hitBounds.x1 -= t; lib.hitBounds.y1 -= t;
        // decode de SVG e lazy: _svgImage e chamado sob demanda por
        // artCanvas/Clip e fica em cache. Prefetch em chunks minusculos
        // agendado em idle — lotes maiores saturavam a fila de decode.
        warmSvgs(lib.movie, 4);
        return lib;
    }

    // Clip base do pinguim (cada PenguinView instancia o seu)
    baseClip() { return new Clip(this.movie); }

    // bounds uniao de todos os frames (coords de mundo, y para cima = negativo)
    _unionBounds() {
        const clip = this.baseClip();
        const m = this.movie;
        let b = null;
        const main = m.data.main;
        for (let f = 1; f <= (main.frames?.length || 1); f++) {
            const entries = main.frames[f - 1] || [];
            const fb = clip._boundsOf(entries, { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, '');
            if (!fb) continue;
            b = b ? [Math.min(b[0], fb[0]), Math.min(b[1], fb[1]), Math.max(b[2], fb[2]), Math.max(b[3], fb[3])]
                  : fb;
        }
        if (!b) b = [-20, -60, 20, 10];
        // margem ampla: os bounds sao ESTATICOS (matrizes das entries) —
        // partes animadas por playheads (bracos da danca, arco do throw,
        // puffle misc) excedem a uniao e clipavam no canvas do sprite.
        // O displaySize deriva de viewW/viewH, entao a margem so adiciona
        // borda transparente — o tamanho na tela nao muda.
        return { x0: Math.floor(b[0]) - 16, y0: Math.floor(b[1]) - 16,
                 x1: Math.ceil(b[2]) + 16, y1: Math.ceil(b[3]) + 16 };
    }

    get viewW() { return this.bounds.x1 - this.bounds.x0; }
    get viewH() { return this.bounds.y1 - this.bounds.y0; }

    // Carrega (lazy) o clip de um item de roupa; cache por id.
    itemClip(itemId) {
        if (!itemId) return Promise.resolve(null);
        if (!this.items.has(itemId)) {
            this.items.set(itemId, MovieRoom.load(`/assets/clothing/${itemId}`)
                .then((mv) => {
                    const clip = new Clip(mv);
                    // Pré-decodifica os SVGs do pack em idle: sem isso o
                    // primeiro frame de ação (dance/throw) renderiza os itens
                    // aos poucos por ~1s enquanto as imagens decodificam.
                    warmSvgs(mv, 8);
                    return clip;
                })
                .catch(() => null));
        }
        return this.items.get(itemId);
    }

    // Prefetch priorizado dos SVGs que este look realmente desenha.
    // Os frames logicos (idle 1-8, walk 9-16, sit 17-24, emotes) sao
    // remapeados para secret frames via animationFrame — decodificar so
    // esses arquivos (e nao os ~1800 do pack inteiro) faz o primeiro walk
    // ficar pronto rapido; sem isso o pinguim "deslizava" aguardando decode.
    // Ordem: walk primeiro (acao mais visivel), depois idle/sit/emotes.
    prefetchLook(look) {
        const seen = new Set();
        const afs = [];
        const push = (f) => { if (!seen.has(f)) { seen.add(f); afs.push(f); } };
        for (const f of [9, 10, 11, 12, 13, 14, 15, 16,
            1, 2, 3, 4, 5, 6, 7, 8,
            17, 18, 19, 20, 21, 22, 23, 24,
            25, 26, 27, 28, 29, 30]) push(this.animationFrame(look, f));
        for (let f = 31; f <= 76; f++) push(this.animationFrame(look, f));
        // walk+idle (afs[0..15]) em BURST real: bg=false dispara todos os
        // _svgImage de uma vez. O modo agendado enfileirava atras do warm
        // da sala (~250 images pendentes + rIC) e o primeiro andar/
        // rotacao de idle "deslizava" ate cada direcao decodificar sob
        // demanda — por isso so ficava certo depois de andar p/ todos os
        // lados. O resto segue paced via _imgCache (idempotente).
        const hotAfs = afs.slice(0, 16);
        this.movie.prefetchFrames(hotAfs, 12, true, null, false);
        this.movie.prefetchFrames(afs, 12);
        for (const slot of ITEM_DRAW_ORDER) {
            const id = look?.[slot];
            if (id) this.itemClip(id).then((clip) => {
                clip?.m.prefetchFrames(hotAfs, 12, true, null, false);
                clip?.m.prefetchFrames(afs, 12);
            });
        }
    }

    // fh() do gp.js: frame real a desenhar dado look equipado + frame logico
    animationFrame(look, frame) {
        const max = this.movie.data.main?.frames?.length || 76;
        const s = this.dh.get(frame);
        if (!s) return frame;
        const sig = VR.map((o) => look[o] ?? 0).join(',');
        const i = s.get(sig);
        return i !== undefined && i <= max ? i : frame;
    }
}

// View de um pinguim: art + itens + estado de animacao.
// render() desenha num canvas 2D ja com transform de escala aplicado.
// Arte do balão de fala — port do layoutBalloon() do cliente web GoPenguin.
// Renderiza os masters (corpo sprite114, rabinho sprite156) sem o message_txt;
// a composição por mensagem segue a mesma matemática do original:
//   d = min(114, maxLineW + 4) + 14   (largura do balão)
//   f = nLines * 13.8 + 11            (altura do corpo)
//   corpo: scale (d/bw, f/bh) com base em y=-48.25 ; rabinho: scaleX=d/vw, y=-48.25
let _bubbleArtPromise = null;
export function bubbleArt(scene) {
    if (!_bubbleArtPromise) {
        _bubbleArtPromise = (async () => {
            const movie = scene.game._interfaceMoviePromise
                ? await scene.game._interfaceMoviePromise
                : await MovieRoom.load('/assets/movies/interface').then((m) => { m.setScale(1); return m; });
            if (!movie) return null;

            // fonte embarcada do editTexts (font 157 = Burbank Small Medium)
            try {
                const ff = new FontFace('BurbankSmallMedium', 'url(/assets/movies/interface/chars/font_157.ttf)');
                await ff.load();
                document.fonts.add(ff);
            } catch (e) { console.warn('[bubble] font', e); }

            const clip = new Clip(movie);
            const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
            const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
            const R = 3;

            async function master(spriteId) {
                const entries = movie.sprites[String(spriteId)]?.frames?.[0] || [];
                const b = clip._boundsOf(entries, IDENT, '');
                if (!b) return null;
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil((b[2] - b[0]) * R);
                canvas.height = Math.ceil((b[3] - b[1]) * R);
                const ctx = canvas.getContext('2d');
                ctx.setTransform(R, 0, 0, R, -b[0] * R, -b[1] * R);
                await clip._drawListFrame(ctx, entries, IDENT, '', IDENT_COLOR, R);
                return { canvas, bounds: b };
            }

            const body = await master(114);   // balloon_mc -> corpo
            const ptr = await master(156);    // pointer_mc -> faixa + rabinho
            if (!body || !ptr) return null;
            return { body, ptr, R };
        })().catch((e) => { console.warn('[bubble] art', e); return null; });
    }
    return _bubbleArtPromise;
}

// Quebra o texto em linhas como o original (wordWrap ~114px, fonte 12px).
export function bubbleLines(message) {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '12px "BurbankSmallMedium", GoPenguin, Arial, sans-serif';
    const maxW = 114;
    const lines = [];
    for (const para of String(message).split(/\r\n|\r|\n/)) {
        let line = '';
        for (const word of para.split(' ')) {
            const cand = line ? line + ' ' + word : word;
            if (c.measureText(cand).width <= maxW || !line) { line = cand; continue; }
            lines.push(line); line = word;
            while (c.measureText(line).width > maxW && line.length > 1) {
                let cut = line.length - 1;
                while (cut > 1 && c.measureText(line.slice(0, cut)).width > maxW) cut--;
                lines.push(line.slice(0, cut));
                line = line.slice(cut);
            }
        }
        lines.push(line);
    }
    return lines;
}

export class PenguinView {
    constructor(lib, color = 0x0088ff) {
        this.lib = lib;
        this.art = lib.baseClip();
        this.art.set('body', { color: veColor(color) });
        this.art.set('ring', { visible: false });
        this.art.set('hotspot', { visible: false });
        this.items = new Map();       // slot -> Clip instance
        this.look = { head: 0, face: 0, neck: 0, body: 0, hand: 0, feet: 0 };
        this.frame = 1;
        this.drawnFrame = 0;
        this.dirty = true;
        this._scaleHint = null;
        this._warmToken = 0;
        this._warmCtx = null;
    }

    setColor(rgb) {
        this.art.set('body', { color: veColor(rgb) });
        this.dirty = true;
    }

    // look: {feet,body,neck,hand,face,head} -> itemId ou null
    // scale: supersampling do render — guardado p/ o warmFrames usar a
    // mesma escala de raster do draw real.
    setLook(look, scale = null) {
        if (scale != null) this._scaleHint = scale;
        let changed = false;
        const loads = [];
        for (const slot of ITEM_DRAW_ORDER) {
            const id = look?.[slot] ? Number(look[slot]) : 0;
            if ((this.look[slot] || 0) === id) continue;
            this.look[slot] = id;
            changed = true;
            if (id) {
                loads.push(this.lib.itemClip(id).then((clip) => {
                    if (!clip || this.look[slot] !== id) return;
                    const inst = clip.instance();
                    inst.set('ring', { visible: false });
                    this.items.set(slot, inst);
                    this.dirty = true;
                }).catch(() => {}));
            } else {
                this.items.delete(slot);
            }
        }
        if (changed) {
            this.dirty = true;
            // garante que os frames deste look (walk/idle/sit) estejam
            // decodificados antes do primeiro uso — evita o "deslizar"
            this.lib.prefetchLook?.(look);
            // depois que as roupas carregam, practice-render dos frames
            // quentes esquenta o cache de raster (artCanvas/solid/tint)
            // com as chaves eff reais — sem isso o primeiro walk de cada
            // direcao pagava dezenas de createImageBitmap sob demanda
            const token = ++this._warmToken;
            this._warmDone = false;
            Promise.all(loads).then(() => {
                if (token === this._warmToken) this.warmFrames();
            });
        }
    }

    // "Practice render" dos frames quentes: desenha walk+idle 1x num canvas
    // minusculo pelo MESMO caminho do render real. Isso popula _artCache,
    // _solidCache e _pixelTint com as chaves (file|eff) exatas — eff =
    // scale*k varia por sprite (~10.6 e ~0.5 no pinguim, NAO ss^2), por
    // isso o warm por prefetchFrames(scale) nao cobria nada. Sequencial:
    // no maximo poucos creates pendentes por vez, e pausa durante
    // _decodeHold para nao competir com o load da sala.
    async warmFrames() {
        const token = this._warmToken;
        const sc = this._scaleHint || this._renderScale || 5.0625;
        if (!this._warmCtx) {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 8;
            this._warmCtx = cv.getContext('2d');
        }
        const ctx = this._warmCtx;
        const look = { ...this.look };
        // Clips DESCARTAVEIS: o waddle anima sprites com timelines de 7-8f
        // (playheads playing). Se o warm usasse os clips vivos, reset/
        // advance corromperia a animacao real — instancias novas compartilham
        // so os caches do movie (artCanvas/_svgImage), que e o objetivo.
        const clips = [new Clip(this.art.m)];
        for (const it of this.items.values()) clips.push(new Clip(it.m));
        for (const f of [9, 10, 11, 12, 13, 14, 15, 16,
            1, 2, 3, 4, 5, 6, 7, 8]) {
            if (token !== this._warmToken) return;
            while (MovieRoom._decodeHold > 0)
                await new Promise((r) => setTimeout(r, 120));
            const af = this.lib.animationFrame(look, f);
            // 9 passos cobrem o loop de 8f dos sub-sprites (draw no frame
            // atual, advance, repete) — mesmo padrao do render real
            for (let step = 0; step < 9; step++) {
                if (token !== this._warmToken) return;
                try {
                    for (const c of clips) await c.draw(ctx, af, sc);
                } catch { /* warm e best-effort */ }
                for (const c of clips) c.advance();
                await new Promise((r) => setTimeout(r, 0));
            }
        }
        if (token === this._warmToken) this._warmDone = true;
    }

    // frame: numero do frame logico da timeline principal (1..76)
    setFrame(frame) {
        const f = Math.max(1, Math.min(76, Math.round(frame) || 1));
        if (f === this.frame) return;
        this.frame = f;
        this.dirty = true;
    }

    get animationFrame() {
        return this.lib.animationFrame(this.look, this.frame);
    }

    // avanca sub-playheads (chamar ~24fps)
    advance() {
        this.art.advance();
        for (const it of this.items.values()) it.advance();
    }

    // desenha no ctx (transform de scale ja aplicada pelo chamador)
    async render(ctx, scale) {
        this._renderScale = scale;
        const af = this.animationFrame;
        if (this.drawnFrame !== af) {
            this.art.resetPlayback();
            for (const it of this.items.values()) it.resetPlayback();
            this.drawnFrame = af;
        }
        await this.art.draw(ctx, af, scale);
        for (const slot of ITEM_DRAW_ORDER) {
            const it = this.items.get(slot);
            if (it) await it.draw(ctx, af, scale);
        }
        this.dirty = false;
    }
}
