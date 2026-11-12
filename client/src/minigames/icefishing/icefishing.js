// Ice Fishing — port do game_fish.c do gopenguin-3ds para o browser.
// Dirige o movie vetorial original (assets/movies/games/fish/IceFishing)
// via MovieRoom: playheads, transforms (set matrix), cores e hit-tests
// (pose/bounds) reproduzem o comportamento do cliente SWF original.

import { MovieRoom } from '../../movie/movie.js';
import {
    FISH_OBJECTS, FISH_GROUPS, FISH_EVENTS, FISH_HITBOX, FISH_LINE_BOX,
    FISH_ROOTS, FISH_TEXT,
} from './icefishing-data.js';

const STAGE_W = 760, STAGE_H = 480, RATE = 24;
const PACK = '/assets/movies/games/fish/IceFishing';
const FRAME_GAME = 38; // _mainFrame (1-based) do estado de gameplay

// Sons extraidos do IceFishing.swf original (Wand vanilla-media) para
// /assets/sfx/fish/sound_N.mp3 — idx = ordem dos DefineSound no SWF
// (o tag sound_343 nao tem sync MP3 e foi pulado). O games.json do CP
// original declara music_id=0 para este minigame: nao havia BGM, so SFX.
// exports do SWF: 1=snip 2=shark 4=ding 5=chomp 6=fishfleesound
// 7=fishicebox (SWF3 = faixa de 130s nao referenciada — descartada).
const SND_IDX = { snip: 0, shark: 1, ding: 3, chomp: 4, fishfleesound: 5, fishicebox: 6 };
// timelines.json renumera os ids dos sons de timeline (o conversor pulou
// o SWF3/musica): conv id -> idx do arquivo extraido.
const TL_SND = { '5': 5, '6': 6, '212': 7, '242': 8, '277': 9, '375': 10, '389': 11, '424': 12, '435': 13 };

const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };

const ROOT_BY_NAME = new Map(FISH_ROOTS.map(r => [r.name, r]));
const TEXT = new Map(FISH_TEXT);
const text = (k) => TEXT.get(k) || '';

function replace(source, a, b) {
    return source.replace(/%0/g, String(a)).replace(/%1/g, String(b));
}

export class IceFishingGame {
    // onExit(): fechar overlay | onCoins(n): reward | penguinColor: [r,g,b] 0-255
    constructor(scene, frame, { onExit, onCoins, penguinColor } = {}) {
        this.scene = scene;
        this.frame = frame;
        this.onExit = onExit || (() => {});
        this.onCoins = onCoins || (() => {});
        this.penguinColor = penguinColor || [255, 255, 255];
        this._destroyed = false;
        this._raf = 0;
        this._acc = 0;
        this._last = 0;
    }

    async init() {
        // canvas de jogo: backing 1520x960 (2x) dentro do frame 1520x960
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1520; this.canvas.height = 960;
        this.canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%;';
        this.frame.appendChild(this.canvas);

        this.movie = await MovieRoom.load(PACK);
        if (this._destroyed) return;
        this.movie._sndQueue = []; // habilita emissao de sons de timeline
        this.movie.prefetchSvgs?.();
        // raster fixo em scale=2: sem isso eff=scale*k muda a cada frame
        // (peixes se movem) -> cache de artCanvas nunca acerta -> re-raster
        // continuo = tela piscando + FPS baixo (mesmo fix do catalogo)
        this.movie.artFlatScale = true;

        // 147.svg = linha da vara: no SWF e um path vertical 0x100 com
        // stroke-width 0.05 dentro de um SVG width="0.0px" — viewport zero
        // rasteriza vazio e o traco hairline fica sub-pixel mesmo com o
        // fallback de size do artCanvas. Override local com viewport real
        // (2x100) e traco ~1px na tela. 148/149/150 = partes do anzol/isca.
        this.movie.setSvgOverride('147.svg',
            '<svg xmlns="http://www.w3.org/2000/svg" width="2px" height="100px" viewBox="0 0 2 100">'
            + '<path d="M0.5 0 L0.5 100" fill="none" stroke="#666666" stroke-width="0.5" stroke-linecap="round"/></svg>');
        for (const f of ['148.svg', '149.svg', '150.svg']) {
            const svg = this.movie._svgText(f);
            if (svg) this.movie.setSvgOverride(f,
                svg.replace(/stroke-width="0\.05"/g, 'stroke-width="1"'));
        }

        // hotspots (sprite 55 = quadrado preto 22x22) sao so hit-test no
        // SWF original — o pack os contem como shapes visiveis; escondemos
        // todos os paths *hotspot/*disthotspot para nao renderizar retangulos.
        // Paths explicitos: collectInteractive so ve o frame atual e os
        // peixes so existem no frame de gameplay.
        const HOT_NAMES = [...FISH_OBJECTS, 'bigFish', 'bigFishApproach',
            'sharkLeft', 'sharkRight', 'hook', 'fishflee', 'grayfishflee'];
        for (const n of HOT_NAMES)
            for (const s of ['.obj.hotspot', '.obj.disthotspot', '.hotspot', '.disthotspot'])
                this.movie.set(`${n}${s}`, { visible: false });

        // qualquer mutacao do movie pode mudar botoes visiveis -> invalida
        const mv = this.movie;
        for (const m of ['goto', 'play', 'stop', 'set']) {
            if (typeof mv[m] !== 'function') continue;
            const orig = mv[m].bind(mv);
            mv[m] = (...a) => { this._invalidateButtons(); return orig(...a); };
        }

        // estado (struct Fishing do C)
        this.positions = new Map();
        this.watched = new Map();
        for (const r of FISH_ROOTS) {
            this.positions.set(r.name, [...r.matrix]);
            this.watched.set(r.name, -1);
        }
        this.seed = (0x714f3e25 ^ (this.scene?.playerIdHash || 1)) >>> 0 || 1;
        this.stamps = 0;
        this.screen = 0;
        this.started = false;
        this.finished = false;
        this._electroLive = false;
        this.model = this._newModel();

        // input — botoes sao os do proprio movie (buttonActions do pack:
        // play_btn, getWorm, getCoins, sendGameOver). Hit-test nos bounds
        // coletados por collectInteractive(); clique fora de botao = acao
        // de pesca (soltar anzol/acima do gelo = store).
        this._btnCache = { frame: -1, at: 0, list: [] };
        this._stagePos = (e) => {
            const r = this.canvas.getBoundingClientRect();
            return [(e.clientX - r.left) / r.width * STAGE_W,
                    (e.clientY - r.top) / r.height * STAGE_H];
        };
        this._onMove = (e) => {
            const [, y] = this._stagePos(e);
            this.model.mouseY = Math.max(0, Math.min(STAGE_H, y));
            this._hoverButtons(e);
        };
        this._onDown = (e) => {
            if (e.target !== this.canvas) return;
            const [sx, sy] = this._stagePos(e);
            const hit = this._buttonAt(sx, sy);
            if (hit) { this._pressButton(hit, 'down'); return; }
            this._onMove(e);
            if (!this.started || !this.model.running) return;
            this._fishDrop();
            this._newWorm(0);
        };
        this.canvas.addEventListener('mousemove', this._onMove);
        this.canvas.addEventListener('mousedown', this._onDown);

        // menu: start_screen (frame 2 do main)
        this.movie.goto('', 2);
        this._last = performance.now();
        this._loop();
    }

    // ---------- botoes nativos do movie ----------

    _invalidateButtons() { this._btnCache.frame = -1; }

    _buttons() {
        const c = this._btnCache;
        const frame = this.movie?._mainFrame ?? -1;
        // re-coleta so quando invalidado (frame do main muda ou qualquer
        // goto/play/set — ex.: prompt/gameOver_mc aparecem sem trocar frame).
        // collectInteractive percorre a arvore inteira: nada de timer.
        if (c.frame !== frame) {
            c.frame = frame;
            c.list = [];
            try {
                const { entries } = this.movie.collectInteractive();
                for (const e of entries) {
                    if (!e.acts?.release) continue;
                    c.list.push({ path: e.path, bounds: e.bounds, release: e.acts.release });
                }
            } catch (_) { /* collectInteractive indisponivel */ }
        }
        return c.list;
    }

    _buttonAt(x, y) {
        for (const b of this._buttons()) {
            const [x0, y0, x1, y1] = b.bounds;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return b;
        }
        return null;
    }

    _hoverButtons(e) {
        const [sx, sy] = this._stagePos(e);
        const over = this._buttonAt(sx, sy);
        for (const b of this._buttons())
            this.movie.setButtonState?.(b.path, b === over ? 'over' : 'up');
    }

    _pressButton(b, state) {
        this.movie.setButtonState?.(b.path, state);
        setTimeout(() => this.movie.setButtonState?.(b.path, 'up'), 120);
        const r = b.release;
        if (/play\s*\(/.test(r)) this._onPlay();
        else if (/getWorm/.test(r)) this._newWorm(30);
        else if (/getCoins|sendGameOver/.test(r)) this._finish();
        else if (/gotoAndStop/.test(r)) this.movie.goto('', 2);
    }

    _newModel() {
        return {
            running: false, over: false, won: false, gray: false,
            hookEmpty: true, isHit: false, hookFalling: false, hasLostLife: false,
            levelBlock: false, sharkActive: false, crabActive: false,
            sharkMoving: [false, false], kickerMoving: [false, false],
            lives: 3, level: 1,
            fishCaught: 0, orangeFish: 0, grayFish: 0, grayCaught: 0,
            consecutive: 0, jellyHits: 0, lineCuts: 0,
            ticks: 0, startTicks: 0, group: 0, iceboxBlock: 0, currentFish: 0,
            speed: 4000, timer: 0, mouseY: 240, hookPrevious: 240,
            cutPoint: 0, lineExtra: 0, oneupAlpha: 100,
        };
    }

    _onPlay() {
        if (this.started) return;
        this.started = true;
        this._electroLive = false;
        const m = this.model;
        m.running = true; m.lives = 3; m.level = 1; m.speed = 4000;
        m.mouseY = 240; m.hookPrevious = 240; m.lineExtra = 0; m.oneupAlpha = 100;
        m.hookEmpty = true; m.isHit = false; m.gray = false;
        m.ticks = 0; m.startTicks = 0; m.timer = 0; m.fishCaught = 0;
        m.orangeFish = 0; m.grayFish = 0; m.grayCaught = 0; m.consecutive = 0;
        m.jellyHits = 0; m.lineCuts = 0; m.levelBlock = false; m.sharkActive = false;
        m.crabActive = false; m.sharkMoving = [false, false]; m.kickerMoving = [false, false];
        m.group = 0; m.iceboxBlock = 0; m.currentFish = 0; m.won = false; m.over = false;

        this.movie.goto('', FRAME_GAME);
        this._musicStart();
        this.movie.set('puffle', { visible: false });
        this.movie.set('gameOver_mc', { visible: false });
        this._label('lives_mc.lives', '3');
        this._label('icebox.fishNum', '0');
        this._label('icebox.fish', 'fish_txt');
        this._label('prompt.newWorm', 'ingame_newworm');
        this._label('gameOver_mc.gameOver', 'ui_gameover');
        this._label('gameOver_mc.collectCoins.label', 'ingame_collectcoins');
        this._applyPenguinColor();
    }

    _applyPenguinColor() {
        const c = this.penguinColor;
        const rgb = Array.isArray(c) ? c : [(c >> 16) & 255, (c >> 8) & 255, c & 255];
        const [r, g, b] = rgb;
        // SWLColor do game_fish.c: mult zera o RGB original, add pinta a cor
        // do jogador — mult=[1,1,1] somava a cor sobre a arte (tint errado)
        const col = { mult: [0, 0, 0, 1], add: [r, g, b, 0] };
        for (const p of ['penguin.body', 'gameOver_mc.body', '#2#12.body', '#2.body', '#2#32.body'])
            this.movie.set(p, { color: col });
    }

    _label(path, key) { this.movie.set(path, { text: text(key) }); }
    _number(path, n) { this.movie.set(path, { text: String(n) }); }

    // ---------- audio ----------

    _sfx(name) {
        const idx = SND_IDX[name];
        if (idx !== undefined) this._playIdx(idx);
    }

    _playIdx(idx) {
        if (!this._sndCache) this._sndCache = new Map();
        let a = this._sndCache.get(idx);
        if (!a) {
            a = new Audio(`/assets/sfx/fish/sound_${idx}.mp3`);
            a.preload = 'auto';
            this._sndCache.set(idx, a);
        }
        try {
            a.volume = 0.9;
            a.currentTime = 0;
            a.play().catch(() => {});
        } catch { /* autoplay policy */ }
    }

    // BGM de teste: faixa longa do SWF em loop durante o gameplay.
    _musicStart() {
        if (this._music) return;
        const a = new Audio('/assets/sfx/fish/sound_2.mp3');
        a.loop = true;
        a.volume = 0.45;
        a.play().catch(() => {});
        this._music = a;
    }

    _musicStop() {
        try { this._music?.pause(); } catch {}
        this._music = null;
    }

    // Sons de timeline emitidos pelo MovieRoom (frames "entrados" via
    // tick/goto) — ids do timelines.json mapeados por TL_SND.
    _drainSounds() {
        for (const id of this.movie.drainSounds?.() || []) {
            const idx = TL_SND[String(id)];
            if (idx !== undefined) this._playIdx(idx);
        }
    }

    // ---------- port dos helpers do C ----------

    _path(name) { return name; } // 'root.X' -> 'X' (main e a raiz)

    _frame(name) {
        const p = this.movie.pose(this._path(name));
        return p ? p.frame : this.movie.currentFrame(this._path(name)) || 1;
    }

    _goto(name, n, playing) { return this.movie.goto(this._path(name), n, playing); }
    _play(name) { const p = this._path(name); this.movie.goto(p, this._frame(name), true); }

    _moveTo(name, x, y) {
        const base = ROOT_BY_NAME.get(name);
        if (!base) return;
        const m = [...base.matrix];
        m[4] = x; m[5] = y;
        this.positions.set(name, m);
        this.movie.set(this._path(name), { matrix: m });
    }
    _moveY(name, y) {
        const p = this.positions.get(name);
        if (p) this._moveTo(name, p[4], y);
    }
    _pos(name) { return this.positions.get(name); }

    _visible(name, v) { this.movie.set(this._path(name), { visible: !!v }); }
    _color(name, mult, add) { this.movie.set(this._path(name), { color: { mult, add } }); }

    _random01() {
        this.seed ^= (this.seed << 13) >>> 0; this.seed >>>= 0;
        this.seed ^= this.seed >>> 17;
        this.seed ^= (this.seed << 5) >>> 0; this.seed >>>= 0;
        return this.seed / 4294967296;
    }

    // pose + hitbox: igual ao box() do C — simbolos 55 (hotspot) e 152 (line)
    // usam meta-bounds; demais paths nao colidem.
    _box(name) {
        const pose = this.movie.pose(this._path(name));
        if (!pose) return null;
        let bounds = null;
        if (pose.id === '55') bounds = FISH_HITBOX;
        else if (pose.id === '152') bounds = FISH_LINE_BOX[pose.frame === 2 ? 1 : 0];
        if (!bounds) return null;
        const m = pose.matrix;
        const out = [Infinity, Infinity, -Infinity, -Infinity];
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
            const px = bounds[x ? 2 : 0], py = bounds[y ? 3 : 1];
            const sx = m.a * px + m.c * py + m.x, sy = m.b * px + m.d * py + m.y;
            out[0] = Math.min(out[0], sx); out[1] = Math.min(out[1], sy);
            out[2] = Math.max(out[2], sx); out[3] = Math.max(out[3], sy);
        }
        return out;
    }

    _hit(a, b) {
        const x = this._box(a), y = this._box(b);
        return !!(x && y && x[0] <= y[2] && x[2] >= y[0] && x[1] <= y[3] && x[3] >= y[1]);
    }

    // ---------- logica do jogo (port 1:1 do tick/frame_input do C) ----------

    _coins() {
        const m = this.model;
        return m.orangeFish * 4 + m.grayFish * 8 + (m.won ? 100 : 0);
    }

    _levelUp() {
        const m = this.model;
        m.level++; m.speed -= 500; m.levelBlock = false;
        this._visible('puffle', false);
    }

    _endLevel(level, count, tip) {
        const m = this.model;
        if (m.fishCaught !== count || m.level !== level) return;
        if (this._frame('puffle') === 1) this._play('puffle');
        this._visible('puffle', true);
        this._label('puffle.obj.levelTip', tip);
        m.levelBlock = true;
    }

    _choose(stopwatch, item) {
        const m = this.model;
        const elapsed = this._now() - m.timer;
        if (elapsed < stopwatch || elapsed > stopwatch + 200) return;
        const name = FISH_OBJECTS[item];
        if (item <= 7 || item === 9 || item === 10 || (item === 8 && m.lives < 3)) this._play(name);
        else if (item === 11 || item === 12) { if (!m.sharkActive) this._play(name); }
        else if (item === 13 || item === 14) { if (!m.crabActive) this._play(name); }
        else if (item === 15 || item === 16) {
            const side = item - 15;
            if (m.kickerMoving[side]) return;
            this._goto(side ? 'kickerRight.obj' : 'kickerLeft.obj', Math.floor(this._random01() + 1.5), false);
            this._moveY(name, this._random01() * 200 + 235);
            m.kickerMoving[side] = true;
        } else if (item >= 17 && m.fishCaught < 56 && m.gray) this._play(name);
    }

    _chooser() {
        const m = this.model;
        if (m.fishCaught < 60 && !m.levelBlock && m.running) {
            if (this._now() - m.timer >= m.speed) {
                m.timer = this._now();
                const level = m.level > 4 ? 4 : m.level;
                m.group = Math.floor(this._random01() * (level === 1 ? 10 : level === 2 ? 20 : 30)) + (level === 4 ? 11 : 1);
            }
            const [start, count] = FISH_GROUPS[m.group] || [0, 0];
            for (let i = 0; i < count; i++) {
                const ev = FISH_EVENTS[start + i];
                if (ev) this._choose(ev[0], ev[1]);
            }
        }
        this._endLevel(1, 5, 'ingame_jellyfish');
        this._endLevel(2, 19, 'ingame_sharks');
        this._endLevel(3, 37, 'ingame_crabs');
        if (m.fishCaught === 60 && this._frame('bigFish') === 1 && this._frame('bigFishApproach') === 1)
            this._play('bigFishApproach');
    }

    _lineScale() {
        const m = this.model;
        const line = this._pos('line');
        const y = line[5], my = m.mouseY;
        let scale = line[3];
        if (y < my && my < 440) {
            if (!m.lineCut || my < m.cutPoint + y) scale = (my - y) / 100;
        } else if (my >= 440 && !m.lineCut) scale = (440 - y) / 100;
        else if (y > my && !m.lineCut) scale = 0;
        const nl = [...line]; nl[3] = scale;
        this.positions.set('line', nl);
        this.movie.set('line', { matrix: nl });
    }

    _hookMove() {
        const m = this.model;
        const line = this._pos('line');
        const top = line[5] + m.lineExtra, my = m.mouseY;
        this._moveY('hook', my >= top && my < 440 ? my : my >= 440 ? 440 : top);
        if (m.hookEmpty && !m.isHit) {
            if (my <= 122) this._goto('hook', 2, false);
            else {
                this._goto('hook', my < m.hookPrevious ? 4 : my > m.hookPrevious ? 3 : 1, false);
                m.hookPrevious = my;
            }
        }
    }

    _flee(gray) {
        const m = this.model;
        m.consecutive = 0;
        this._sfx('fishfleesound');
        const hook = this._pos('hook');
        const name = gray ? 'grayfishflee' : 'fishflee';
        this._moveTo(name, hook[4], hook[5]);
        this._goto(name, 2, true);
    }

    _fishHit(gray) {
        if ((gray && !this.model.gray) || this._frame('hook') >= 5) return;
        const count = gray ? 4 : 8;
        for (let i = 1; i <= count; i++) {
            const name = `${gray ? 'grayfish' : 'fish'}${i}`;
            if (this._frame(name) > 1 && this._hit(`${name}.obj.hotspot`, 'hook.hotspot')) {
                this._goto(name, 1, false);
                this._goto('hook', gray ? 7 : 5, false);
                this.model.hookEmpty = false;
                this._sfx('chomp');
            }
        }
    }

    _fishDrop() {
        const m = this.model;
        const hook = this._frame('hook');
        if (m.isHit || m.hookEmpty || (hook !== 5 && hook !== 7)) return;
        const gray = hook === 7;
        if (m.mouseY <= 122) {
            const block = m.iceboxBlock;
            this._storeFish(gray);
            this._goto('hook', 2, false);
            if (block !== m.iceboxBlock) this._goto('icebox', this._frame('icebox') + 1, false);
            const pose = this.movie.pose(`icebox.fishblock${m.iceboxBlock}`);
            const n = pose ? pose.frame : 1;
            this._goto(`icebox.fishblock${m.iceboxBlock}`, n + 1, false);
            if (gray) this._goto(`icebox.fishblock${m.iceboxBlock}.fish${m.currentFish}`, 2, false);
            if (m.fishCaught >= 63) { /* stamp fly — ignorado */ }
            this._number('icebox.fishNum', m.fishCaught);
            this._label('icebox.fish', m.fishCaught === 1 ? 'ingame_fish' : 'ingame_fishies');
            this._sfx('fishicebox');
        } else {
            this._goto('hook', 1, false);
            this._flee(gray);
        }
        m.hookEmpty = true;
    }

    _storeFish(gray) {
        const m = this.model;
        const capacity = [6, 8, 6, 16, 18];
        if (m.iceboxBlock < 5 && m.currentFish === capacity[m.iceboxBlock]) {
            m.currentFish = 1; m.iceboxBlock++;
        } else m.currentFish++;
        m.fishCaught++; m.consecutive++;
        if (gray) { m.grayFish++; m.grayCaught++; } else m.orangeFish++;
    }

    _lineCut(collider) {
        const m = this.model;
        m.lineCuts++;
        const hook = this._frame('hook');
        if (!collider.startsWith('crab') && (hook === 5 || hook === 7)) this._flee(hook === 7);
        if (!collider.startsWith('shark')) m.hookFalling = true;
        const cy = this._pos(collider)[5];
        if (m.hookFalling) {
            this._moveTo('hookFall', this._pos('hook')[4], this._pos('hookFall')[5]);
            const mask = this.movie.pose('hookFall.mask');
            if (mask) this.movie.set('hookFall.mask', { matrix: [1, 0, 0, 1, 0, cy - m.mouseY] });
        }
        m.lineCut = m.isHit = true;
        this._visible('hook', false);
        this._goto('hook', 50, false);
        this.watched.set('hook', 50);
        this._emptyHook();
        const line = this._pos('line');
        const nl = [...line]; nl[3] = (cy - line[5]) / 100;
        this.positions.set('line', nl);
        this.movie.set('line', { matrix: nl });
        m.cutPoint = cy - line[5];
    }

    _jellyHit() {
        const m = this.model;
        if (m.isHit) return;
        for (let i = 1; i <= 2; i++) {
            const name = `jfish${i}`;
            if (this._frame(name) > 1 && (this._hit(`${name}.obj.hotspot`, 'hook.hotspot') || this._hit(`${name}.obj.hotspot`, 'line'))) {
                m.isHit = true;
                const hook = this._frame('hook');
                if (hook === 5 || hook === 7) this._flee(hook === 7);
                m.jellyHits++;
                // AS2: hook.gotoAndStop(6) — o frame 6 contem o filho
                // 'electro' (sprite 173) que toca 16 frames e no ultimo
                // dispara _parent.gotoAndStop("empty") -> hook frame 50 ->
                // needWorm -> prompt -> getWorm reseta isHit e perde vida.
                this._goto('hook', 6, false);
                this._goto('line', 2, false);
                this.movie.goto('penguin', 'electro', true);
                this._electroLive = true;
                // re-arma o playhead do electro se ele ja existe (parado
                // apos o disparo anterior); na 1a vez o render o cria
                // tocando por padrao.
                this.movie.gotoPath('hook.electro', 1, true);
            }
        }
    }

    _sharkHit() {
        const m = this.model;
        if (m.isHit) return;
        if (this._hit('sharkLeft.hotspot', 'hook.hotspot')) { this._lineCut('sharkLeft'); this._sfx('shark'); }
        if (this._hit('sharkRight.hotspot', 'hook.hotspot')) {
            if (!m.hookEmpty) { /* stamp snack */ }
            this._lineCut('sharkRight');
            this._sfx('shark');
        }
    }

    _crabHit() {
        if (this.model.isHit) return;
        for (let i = 1; i <= 2; i++) {
            const name = `crab${i}`;
            if (this._hit(`${name}.hotspot`, 'line')) this._lineCut(name);
        }
    }

    _kickerHit() {
        for (let side = 0; side < 2; side++) {
            const path = side ? 'kickerRight.obj.hotspot' : 'kickerLeft.obj.hotspot';
            if (this._hit(path, 'hook.hotspot')) {
                const hook = this._frame('hook');
                if (hook === 5 || hook === 7) {
                    this._goto('hook', 1, false);
                    this._flee(hook === 7);
                    this._hookMove();
                    this.model.hookEmpty = true;
                }
            }
        }
    }

    _sharks() {
        const m = this.model;
        const hook = this._pos('hook');
        for (let side = 0; side < 2; side++) {
            const name = side ? 'sharkRight' : 'sharkLeft';
            const p = this._pos(name);
            let x = p[4], y = p[5];
            if (m.sharkMoving[side]) {
                x += side ? -12 : 12;
                this._moveTo(name, x, y);
                this._goto(name, Math.hypot(x - hook[4], y - hook[5]) < 150 && !m.lineCut ? 2 : 1, false);
            }
            if (side ? x < -700 : x > 1500) {
                this._moveTo(name, side ? 1000 : -100, y);
                m.sharkMoving[side] = false;
                if (!m.sharkMoving[0] && !m.sharkMoving[1]) m.sharkActive = false;
            }
        }
    }

    _kickers() {
        for (let side = 0; side < 2; side++) {
            const name = side ? 'kickerRight' : 'kickerLeft';
            const p = this._pos(name);
            let x = p[4], y = p[5];
            if (this.model.kickerMoving[side]) {
                x += side ? -4 : 4;
                this._moveTo(name, x, y);
            }
            if (side ? x < -300 : x > 1000) {
                this._moveTo(name, side ? 1000 : -300, y);
                this.model.kickerMoving[side] = false;
            }
        }
    }

    _lineMask() {
        const m = this.model;
        const fall = this._pos('hookFall');
        if (!m.lineCut) {
            if (!m.hookFalling) this._moveY('hookFall', m.mouseY);
            else {
                this._goto('hookFall', 1, false);
                this._moveTo('hookFall', 900, fall[5]);
                m.hookFalling = false;
            }
            return;
        }
        if (fall[5] < 800) {
            this._goto('hookFall', 2, false);
            this._moveY('hookFall', fall[5] + 20);
        } else {
            this._goto('hookFall', 1, false);
            this._moveTo('hookFall', 900, fall[5]);
            m.hookFalling = false;
        }
    }

    _oneup() {
        const m = this.model;
        if (m.oneupAlpha === 100 && this._frame('hook') < 50 && this._frame('oneup') > 1
            && this._hit('oneup.obj.hotspot', 'hook.hotspot')) {
            m.oneupAlpha -= 10;
            m.lives++;
            this._number('lives_mc.lives', m.lives);
            this._label('oneupText.mc.label', 'ingame_1UP');
            this._moveTo('oneupText', 367, 330);
            this._goto('oneupText', 2, true);
            this._sfx('ding');
        } else if (m.oneupAlpha < 100) m.oneupAlpha -= 10;
        if (m.oneupAlpha < 10) {
            this._goto('oneup', 1, false);
            m.oneupAlpha = 100;
        }
        this._color('oneup', [1, 1, 1, m.oneupAlpha / 100], [0, 0, 0, 0]);
    }

    _bigFish() {
        if (this._frame('bigFish') <= 1 || this._frame('hook') !== 5) return;
        if (this._frame('bigFish') < 165)
            this.movie.goto('bigFish.obj', this._hit('bigFish.obj.disthotspot', 'hook.hotspot') ? 2 : 1, false);
        if (!this.model.won && this._hit('bigFish.obj.hotspot', 'hook.hotspot')) {
            this.movie.goto('', 39, false);
            this._mullet();
        }
    }

    _emptyHook() {
        if (this.model.lives === 0) this._gameOver();
        else {
            this._goto('prompt', 2, false);
            this._label('prompt.newWorm', 'ingame_newworm');
        }
    }

    _newWorm(extra) {
        const m = this.model;
        if (m.lives <= 0 || this._frame('prompt') !== 2 || m.mouseY > 122 + extra) return;
        this._goto('hook', 2, false);
        this._goto('prompt', 1, false);
        this._visible('hook', true);
        m.isHit = false; m.hookEmpty = true; m.hasLostLife = true;
        m.lives--; m.lineCut = false;
        this._number('lives_mc.lives', m.lives);
    }

    _scoreText(base) {
        const m = this.model;
        let value;
        if (m.gray) {
            const orange = replace(text('ingame_yellowfishscore'), m.orangeFish, m.orangeFish * 4);
            const gray = replace(text('ingame_grayfishscore'), m.grayFish, m.grayFish * 8);
            value = orange + '\n' + gray;
        } else value = replace(text('ui_fishcaught'), m.fishCaught, 0);
        this.movie.set(`${base}.fishNum`, { text: value });
        this._label(`${base}.gameOver`, m.won ? 'ingame_bigfish' : 'ui_gameover');
        this._label(`${base}.collectCoins.label`, 'ingame_collectcoins');
    }

    _gameOver() {
        const m = this.model;
        if (m.over) return;
        m.running = false; m.over = true;
        this._visible('hook', false);
        this._visible('gameOver_mc', true);
        if (m.gray) this._goto('gameOver_mc', 2, false);
        this._scoreText('gameOver_mc');
    }

    _mullet() {
        const m = this.model;
        if (m.won) return;
        m.running = false; m.over = m.won = true;
        this._scoreText('gameOver_mc'); // C usa root#2#32; gameOver_mc cobre os dois
        this._visible('gameOver_mc', true);
    }

    _now() { return this.model.ticks * (1000 / RATE); }

    // watch(): eventos por mudanca de frame (port do watch() do C)
    _watch() {
        for (const r of FISH_ROOTS) {
            const name = r.name;
            // frame "entrado" neste tick tem prioridade: a acao do frame
            // (ex.: puffle 237 -> gotoAndStop(1)) roda no mesmo tick e o
            // currentFrame ja mostra o destino — sem isso o watch nunca ve
            // o 237 e o levelUp nunca dispara (loop infinito do puffle).
            const n = this.movie._entered?.get(name) ?? this._frame(name);
            const last = this.watched.get(name);
            if (n === last) continue;
            this.watched.set(name, n);
            if (last === -1) continue;
            if (name === 'hook' && n === 50) this._emptyHook();
            else if ((name === 'jfish1' || name === 'jfish2') && n === 2) this._moveY(name, 250 + this._random01() * 200);
            else if (name === 'finLeft' || name === 'finRight') {
                const side = name === 'finLeft' ? 0 : 1;
                if (n === 2) this.model.sharkActive = true;
                if (n === 101) {
                    this._moveY(side ? 'sharkLeft' : 'sharkRight', 300 + this._random01() * 100);
                    this.model.sharkMoving[side] = true;
                }
            } else if (name === 'oneupText' && n === 11) this._moveTo(name, 1000, 100);
            else if ((name === 'fishflee' || name === 'grayfishflee') && n === 23) {
                this._goto(name, 1, false);
                this._moveTo(name, 900, this._pos(name)[5]);
            } else if (name === 'crab1' || name === 'crab2') {
                // n==148 som snip; n==149 crab_hit
                if (n === 148) this._sfx('snip');
                if (n === 149) this._crabHit();
            } else if (name === 'puffle' && n === 237) {
                this._levelUp();
                this._goto(name, 1, false);
            } else if (name === 'bigFishApproach') {
                if (n === 249) this._play(FISH_OBJECTS[1]);
                if (n === 311) this._play(FISH_OBJECTS[6]);
                if (n === 489) this._play(FISH_OBJECTS[3]);
                if (n === 769) this._play('bigFish');
            } else if (name === 'bigFish' && n === 227) this._gameOver();
        }
    }

    _tick() {
        const m = this.model;
        m.ticks++;
        this.movie.tick();
        this._drainSounds();
        this._watch();
        if (!this.started || !m.running) return;
        this._chooser();
        this._lineScale();
        this._hookMove();
        if (this._pos('hook')[5] > 120) {
            if (m.level > 0) { this._fishHit(false); this._kickerHit(); this._fishHit(true); }
            if (m.level > 1) this._jellyHit();
            if (m.level > 2) this._sharkHit();
        }
        if (this._frame('penguin') < 10)
            this.movie.goto('penguin', m.isHit ? 3 : m.mouseY <= 122 ? 1 : 2, false);
        this.movie.goto('penguin.wormCan', m.lives < 1 ? 2 : 1, false);
        this._bigFish();
        this._sharks();
        this._kickers();
        this._lineMask();
        this._oneup();
        this._watch();
        // o playhead 'hook.electro' nao morre quando o hook sai do frame 6
        // (diferente do Flash, que destroi o clip filho) — sem isto ele
        // ficaria em loop disparando _parent.gotoAndStop("empty") e
        // drenaria vidas para sempre. Estanca ao sair do frame 6.
        if (this._electroLive && this._frame('hook') !== 6) {
            this.movie.gotoPath('hook.electro', 1, false);
            this._electroLive = false;
        }
        this._drainSounds();
    }

    _finish() {
        if (this.finished) return;
        this.finished = true;
        this._musicStop();
        const coins = this.started ? this._coins() : 0;
        this.onCoins(coins);
        this.destroy();
        this.onExit();
    }

    async _loop() {
        if (this._destroyed) return;
        const now = performance.now();
        let dt = now - this._last;
        this._last = now;
        if (dt > 250) dt = 250;
        this._acc += dt;
        const step = 1000 / RATE;
        let guard = 0;
        let ticked = false;
        while (this._acc >= step && guard++ < 8) {
            this._acc -= step;
            ticked = true;
            try { this._tick(); } catch (e) { console.warn('[icefishing] tick', e); }
        }
        // render so quando o movie avancou (24fps) — renderFrame redesenha
        // a timeline inteira; renderizar a 60fps o mesmo frame era desperdicio.
        // Desenha num buffer offscreen e faz UM blit sincrono: sem isso o
        // clearRect+draws assincronos exibiam frames parciais = tela piscando.
        if (ticked) {
            try {
                if (!this._buf) {
                    this._buf = document.createElement('canvas');
                    this._buf.width = this.canvas.width; this._buf.height = this.canvas.height;
                }
                await this.movie.renderFrame(undefined, this._buf, 2);
                const ctx = this.canvas.getContext('2d');
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(this._buf, 0, 0);
            } catch (e) { console.warn('[icefishing] render', e); }
        }
        this._raf = requestAnimationFrame(() => this._loop());
    }

    destroy() {
        this._destroyed = true;
        this._musicStop();
        cancelAnimationFrame(this._raf);
        this.canvas?.removeEventListener('mousemove', this._onMove);
        this.canvas?.removeEventListener('mousedown', this._onDown);
        this.canvas?.remove();
    }
}
