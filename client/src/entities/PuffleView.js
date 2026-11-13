// PuffleView.js — entidade do pet "passeando" atrás do pinguim.
// Renderiza os sprites originais /assets/puffle/<cor> (convertidos dos
// SWFs do wand via swf2movie): timeline principal stand=1..8 (8 direções),
// walk=9..16, walkhop=17..24, misc=25+. Os sub-clips (corpo/feet) têm
// playheads próprios que avançam sozinhos (animação do ciclo de passos).
// Lógica de follow portada do gopenguin (offset -20,+8 atrás do dono,
// velocidade limitada, settle quando o dono para).
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';

// especie do server -> pasta do sprite
export const SPECIES_SPRITE = {
    puffle_blue: 'blue', puffle_pink: 'pink', puffle_black: 'black',
    puffle_green: 'green', puffle_purple: 'purple', puffle_red: 'red',
    puffle_yellow: 'yellow', puffle_white: 'white',
    puffle_orange: 'orange', puffle_brown: 'brown',
};
// ordem dos botoes adoptPuffle(N) do catalogo adopt (gp: blue..orange)
export const ADOPT_SPECIES = [
    'puffle_blue', 'puffle_pink', 'puffle_black', 'puffle_green',
    'puffle_purple', 'puffle_red', 'puffle_yellow', 'puffle_white',
    'puffle_orange',
];

// Renderiza o icone estático /assets/puffle-icons/<cor> num canvas ->
// texture key do Phaser (usado no prompt de nome e na lista de pets).
const _iconCache = new Map(); // dir -> Promise<key|null>
export function puffleIconTexture(scene, species, size = 64) {
    const dir = SPECIES_SPRITE[species];
    if (!dir) return Promise.resolve(null);
    if (!_iconCache.has(dir)) {
        _iconCache.set(dir, (async () => {
            const movie = await MovieRoom.load(`/assets/puffle-icons/${dir}`)
                .catch((e) => { console.warn('[puffle-icon] load', dir, e); return null; });
            if (!movie) return null;
            const clip = new Clip(movie);
            const cv = document.createElement('canvas');
            cv.width = cv.height = size * 2;
            const ctx = cv.getContext('2d');
            ctx.scale(2, 2);
            // centraliza o desenho: bounds do frame principal
            const entries = movie._mainTl?.frames?.[0] || [];
            const b = clip._boundsOf(entries, IDENT, '') || [0, 0, size, size];
            const w = b[2] - b[0], h = b[3] - b[1];
            const s = Math.min(size / Math.max(1, w), size / Math.max(1, h));
            ctx.translate(size / 2 - (b[0] + w / 2) * s, size / 2 - (b[1] + h / 2) * s);
            ctx.scale(s, s);
            await clip._drawListFrame(ctx, entries, IDENT, '', IDENT_COLOR, 1);
            const key = `puffle_icon_${dir}`;
            if (scene.textures.exists(key)) scene.textures.remove(key);
            scene.textures.addCanvas(key, cv);
            return key;
        })().catch(() => null));
    }
    return _iconCache.get(dir);
}
// índice do tipo p/ paper_mc do puffle card (ordem do adoptPuffle do gp)
export const SPECIES_TYPE = {
    puffle_blue: 0, puffle_pink: 1, puffle_black: 2, puffle_green: 3,
    puffle_purple: 4, puffle_red: 5, puffle_yellow: 6, puffle_white: 7,
    puffle_orange: 8, puffle_brown: 9,
};

const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
// canvas 96px a SS=2 cobre 48x48 unidades de mundo — o puffle (~30x25
// unidades no stage 50x50 do SWF) renderiza no tamanho real (~1/3 do
// pinguim). Antes eu escalava p/ preencher o canvas e o pet virava um
// borrão maior que o pinguim.
const FRAME_W = 96, FRAME_H = 96, SS = 2, WORLD_BOX = FRAME_W / SS;
// Comparacao visual com original (Papirolo) e gopenguin (Rockhopper):
// o puffle andando e MENOR que o sprite nativo do stage — ~0.75x.
// Nativo (1.0) renderizava "tamanho de igloo", maior que o original.
const PUFFLE_SCALE = 0.65;
// img.y tal que a base da sombra (canvas y=84/96 = fracao ~0.875) caia em
// owner.y+20 — mesma linha dos pes do pinguim (sprite bottom = y+20).
// imgY = 12 - (0.875-0.5)*WORLD_BOX*PUFFLE_SCALE = 0.24 -> 0
const IMG_Y = 0;

const _movieCache = new Map(); // dir -> Promise<MovieRoom|null>
function puffleMovie(dir) {
    if (!_movieCache.has(dir)) {
        _movieCache.set(dir, MovieRoom.load(`/assets/puffle/${dir}`)
            .then((m) => { m.setScale(1); return m; })
            .catch((e) => { console.warn('[puffle] load', dir, e); _movieCache.delete(dir); return null; }));
    }
    return _movieCache.get(dir);
}

// direcao 1-8 -> frame da timeline principal (labels do SWF:
// stand = frame dir, walk = frame dir+8 — mesmo esquema do pinguim)
const standFrame = (d) => d;
const walkFrame = (d) => d + 8;

// Reacoes de cuidado (PuffleCard) -> frames do misc, port do mapa Ya= do
// gopenguin: play=27, rest=25, eat=31, cookie=30, gum=29, bath=34.
// O frame fica fixo e os sub-playheads (advance a 24fps) animam a acao.
const CARE_FRAMES = { play: 27, rest: 25, eat: 31, cookie: 30, gum: 29, bath: 34, dance: 35 };
// Emotes do dono -> frame unico do misc (cada frame e uma sub-animacao
// completa; NUNCA alternar frames — medido por trajetoria de pixels:
// f27=play/hop (wave), f35=balanceio lateral = a "danca" do puffle.
// f32/33 sao poses quase estaticas — usar elas era o bug do puffle
// "parado" durante dance/wave.
const OWNER_EMOTE_FRAMES = { 25: 27, 26: 35 };
// duracao em ticks a 24fps (~4s) — o gp usa nl[type] por especie (100-260)
const CARE_TICKS = { play: 96, rest: 72, eat: 60, cookie: 60, gum: 60, bath: 72 };

export default class PuffleView {
    // pet: {petRowId, species, name}; owner: Penguin (local ou remoto)
    constructor(scene, pet, owner) {
        this.scene = scene;
        this.pet = pet;
        this.owner = owner;
        this.color = SPECIES_SPRITE[pet.species] || null;
        // puffle fica a DIREITA do pinguim: [penguin] [puffle] — como no
        // original (print do Papirolo) e no gopenguin (Rockhopper)
        // spawn junto ao offset de follow (medido contra o sprite real:
        // ty=owner.y alinha a base do puffle com a dos pes do pinguim)
        this.x = owner.x + 30;
        this.y = owner.y;
        this.tx = this.x; this.ty = this.y;
        this.dir = 5;          // 1-8, mesma convencao do Penguin.directionToward
        this.walking = true;   // sprite entra andando até alcançar o dono
        this.frame = standFrame(this.dir);
        this._ready = false;
        this._dead = false;
        this._animAcc = 0;
        this._emoteActive = false;
        this._care = null;    // {frame, ticks, max} — reacao de cuidado em curso

        this.container = scene.add.container(this.x, this.y);
        this.canvas = document.createElement('canvas');
        this.canvas.width = FRAME_W; this.canvas.height = FRAME_H;
        this.ctx = this.canvas.getContext('2d');
        this.texKey = `puffle_${this.color || 'x'}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        scene.textures.addCanvas(this.texKey, this.canvas);
        this.img = scene.add.image(0, IMG_Y, this.texKey)
            .setOrigin(0.5, 0.5)
            .setDisplaySize(WORLD_BOX * PUFFLE_SCALE, WORLD_BOX * PUFFLE_SCALE);
        this.container.add(this.img);
        this._syncDepth();

        if (this.color) this._init();
    }

    async _init() {
        const movie = await puffleMovie(this.color);
        if (this._dead) return;
        if (!movie || !this.scene.sys.isActive()) {
            // cena pode estar dormindo numa transicao de sala quando o
            // load resolve — o delayedCall so dispara no resume; sem isso
            // o pet ficava invisivel pra sempre
            this.scene.time?.delayedCall?.(800, () => {
                if (!this._dead && !this._ready) this._init();
            });
            return;
        }
        if (this.movie) return; // ja montado (retry apos wake)
        this.movie = movie;
        this.clip = new Clip(movie);
        this._main = movie._mainTl;
        // bounds do puffle inteiro (todos os frames) p/ centralizar no canvas
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const f of this._main.frames) {
            const b = this.clip._boundsOf(f, IDENT, '');
            if (!b) continue;
            x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
            x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
        }
        this._cx = (x0 + x1) / 2;  // centro-x do puffle (unidades do stage)
        this._fy = y1;             // base/pés (maior y)
        // pés (~4) devem cair ~9px acima da origem do container p/ o pet
        // "pisar" no chao junto com o pinguim; topo do canvas = -27 mundo
        this._ty = (FRAME_H - 10) - SS * this._fy;
        this._tx = FRAME_W / 2 - SS * this._cx;
        this._ready = true;
        this._draw();
    }

    _syncDepth() {
        // sempre 1 camada atras do dono — o offset +8 em y fazia o pet
        // pular de faixa de depth e renderizar NA FRENTE do pinguim
        // (parecia um borrão colado nos pes)
        this.container.setDepth((this.owner?.depth ?? 0) - 1);
    }

    // reacao de cuidado vinda do card (PLAYER_PET_CARE -> 'player-pet-care')
    react(kind) {
        const frame = CARE_FRAMES[kind];
        if (!frame || !this._ready || this._dead) return;
        // gp: movie.resetPlayback() antes do frame — sem isso os sub-clips
        // ficam no playhead que o walk deixou e o misc renderiza vazio
        this.clip?.resetPlayback?.();
        this._care = { frame, ticks: 0, max: CARE_TICKS[kind] || 60 };
    }

    // desenho estatico de um frame (emote/cuidado): para no lugar, sem follow
    _still(dt) {
        this.container.setPosition(this.x, this.y);
        this._syncDepth();
        this._draw();
        this._animAcc += dt;
        if (this._animAcc >= 1 / 24) {
            this._animAcc %= 1 / 24;
            this.clip?.advance?.();
        }
    }

    // chamado pelo RoomScene.update — segue o dono como no original
    tick(dt) {
        if (!this._ready || !this.owner || this._dead) return;
        const o = this.owner;
        // reacao de cuidado tem prioridade: congela o follow ate acabar
        if (this._care) {
            if (++this._care.ticks > this._care.max) { this._care = null; this._emoteActive = false; }
            else {
                this.walking = false;
                this.frame = this._care.frame;
                this._still(dt);
                return;
            }
        }
        // Emotes do dono (frames do penguin.swf): wave=25 -> puffle "play"
        // (27), dance=26 -> puffle misc 35 (balanceio = danca); sit (17-24)
        // -> puffle "rest" (25). Cada misc frame e uma sub-animacao que os
        // playheads tocam sozinhos — o frame fica FIXO enquanto o dono
        // emoteia (alternar frames cortava a animacao no meio).
        const act = o.action;
        const emoteFrame = OWNER_EMOTE_FRAMES[act];
        const sitting = !emoteFrame && act >= 17 && act <= 24;
        if (emoteFrame || sitting) {
            // transicao p/ emote: reseta os playheads dos sub-clips (port do
            // resetPlayback do gp) — frames misc dependem deles p/ animar
            if (!this._emoteActive) {
                this._emoteActive = true;
                this.clip?.resetPlayback?.();
            }
            this.walking = false;
            this.frame = emoteFrame ?? 25;
            this._still(dt);
            return;
        }
        this._emoteActive = false;
        // alvo: (+30, 0) — gap horizontal maior que o inicial (+20 ficava
        // colado no pe do pinguim) e base alinhada aos pes do dono.
        // Medido em pixels opacos: com ty=o.y+8 a sombra do puffle ficava
        // ~8px abaixo da linha dos pes; com ty=o.y os bottoms coincidem.
        this.tx = o.x + 30; this.ty = o.y;
        const dx = this.tx - this.x, dy = this.ty - this.y;
        const dist = Math.hypot(dx, dy);
        const ownerMoving = !!(o.isMoving || o.moveTarget || o.moveTween);
        if (dist > 200) { this.x = this.tx; this.y = this.ty; } // teleport como no gp
        else if (dist > 2 || (ownerMoving && dist > 1)) {
            const sp = 144 * dt; // 6px por tick a 24fps — port exato do gp
            const step = Math.min(dist, sp);
            this.x += dx / dist * step;
            this.y += dy / dist * step;
            this.walking = true;
            // direcao 1-8 identica ao Penguin.directionToward
            this.dir = ((Math.round((Math.atan2(dy, dx) * 180 / Math.PI - 90) / 45) % 8) + 8) % 8 + 1;
        } else {
            this.walking = false;
        }
        // parado: o puffle "olha" na mesma direcao do dono — o direction do
        // pinguim ja reflete o mouse (facePoint) localmente e a direcao
        // sincronizada via rede nos remotos, entao vale pros dois lados
        if (!this.walking) this.dir = o.direction;
        this.frame = this.walking ? walkFrame(this.dir) : standFrame(this.dir);
        this.container.setPosition(this.x, this.y);
        this._syncDepth();
        this._draw();
        // playheads dos sub-clips a ~24fps como o frameRate do SWF —
        // chamar advance() todo frame (60fps) acelerava o ciclo de passos
        this._animAcc += dt;
        if (this._animAcc >= 1 / 24) {
            this._animAcc %= 1 / 24;
            this.clip?.advance?.();
        }
    }

    async _draw() {
        if (!this._ready || this._drawing) return;
        this._drawing = true;
        try {
            const ctx = this.ctx, c = this.clip;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, FRAME_W, FRAME_H);
            const entries = this._main.frames[this.frame - 1] || this._main.frames[0] || [];
            // escala 1:1 (unidade do stage = px de mundo) com supersample SS
            ctx.setTransform(SS, 0, 0, SS, this._tx, this._ty);
            await c._drawListFrame(ctx, entries, IDENT, '', IDENT_COLOR, SS * 2);
            // sem refresh() a textura Phaser fica presa no primeiro frame
            // (canvas em branco) — o puffle nunca aparecia na sala
            this.scene.textures.get(this.texKey)?.refresh();
        } catch (e) {
            if (!this._drawErr) { this._drawErr = true; console.warn('[puffle] draw', e); }
        } finally {
            this._drawing = false;
        }
    }

    destroy() {
        this._dead = true;
        if (this.texKey && this.scene.textures.exists(this.texKey)) {
            this.scene.textures.remove(this.texKey);
        }
        this.container?.destroy(true);
    }
}
