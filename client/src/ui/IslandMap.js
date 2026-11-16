// IslandMap.js — mapa da ilha do Club Penguin (map.swf vetorial).
// Port do openMap() do gopenguin + INTERFACE.showHint do map.swf original:
//   - janela: dim rgba(0,0,0,.25) + stage do movie escalado para a regiao
//     bounds [105,37,660,421] do stage 760x480 + moldura branca 2px
//   - botoes *_btn com estado 'over' (sprite do botao escala ~1.07) e
//     hint_mc (UiTooltip) com o nome da sala no rollOver/rollOut
//   - langtown_mc/langplaza_mc/note_mc ficam no frame do idioma (english=1)
//   - igloos_btn abre o mapa de iglus (ainda nao portado -> lodge)
import { MovieRoom } from '../movie/movie.js';
import { UiTooltip } from './Tooltip.js';
import HINTS from './hints.js';
import { WORLD_W, WORLD_H, SS_FIXED } from '../display.js';

// regiao do stage 760x480 que o mapa ocupa (spec.bounds do gp openMap)
const MAP_BOUNDS = [105, 37, 660, 421];
// layout da janela — mesma formula do be.draw do gp:
// scale = min((w-24)/bw, (h-24)/bh, max(maxScale, h/480)); box = bounds*scale
const MAP_SCALE = Math.min(
    (WORLD_W - 24) / (MAP_BOUNDS[2] - MAP_BOUNDS[0]),
    (WORLD_H - 24) / (MAP_BOUNDS[3] - MAP_BOUNDS[1]),
    Math.max(1.5, WORLD_H / 480),
);
const MAP_BOX_W = Math.ceil((MAP_BOUNDS[2] - MAP_BOUNDS[0]) * MAP_SCALE);
const MAP_BOX_H = Math.ceil((MAP_BOUNDS[3] - MAP_BOUNDS[1]) * MAP_SCALE);
const MAP_BOX = [
    Math.round((WORLD_W - MAP_BOX_W) / 2),
    Math.round((WORLD_H - MAP_BOX_H) / 2),
];
MAP_BOX[2] = MAP_BOX[0] + MAP_BOX_W;
MAP_BOX[3] = MAP_BOX[1] + MAP_BOX_H;
// transform stage -> mundo: world = ORIGIN + stage * MAP_SCALE
const MAP_ORIGIN = [MAP_BOX[0] - MAP_BOUNDS[0] * MAP_SCALE, MAP_BOX[1] - MAP_BOUNDS[1] * MAP_SCALE];

// path do botao (findButtons) -> { room, hint } — port dos onRelease/onRollOver
// do frame_1/DoAction.as do map.swf. berg_btn nao tem hint no original.
const BUTTONS = {
    'langtown_mc.town_btn': { room: 'town', hint: 'town_hint' },
    'langplaza_mc.plaza_btn': { room: 'plaza', hint: 'plaza_hint' },
    dock_btn: { room: 'dock', hint: 'dock_hint' },
    fort_btn: { room: 'forts', hint: 'forts_hint' },
    beach_btn: { room: 'beach', hint: 'beach_hint' },
    village_btn: { room: 'village', hint: 'village_hint' },
    mtn_btn: { room: 'mtn', hint: 'mtn_hint' },
    cove_btn: { room: 'cove', hint: 'cove_hint' },
    forest_btn: { room: 'forest', hint: 'forest_hint' },
    dojo_btn: { room: 'dojoext', hint: 'dojoext_hint' },
    mine_btn: { room: 'shack', hint: 'mine_hint' },
    berg_btn: { room: 'berg' },
    rink_btn: { room: 'rink', hint: 'rink_hint' },
    igloos_btn: { room: 'lodge', hint: 'igloos_hint' },
    close_btn: { close: true },
};

export default class IslandMap {
    constructor(scene) {
        this.scene = scene;
        this.open = false;
        this.container = null;
        this.dim = null;
        this._moviePromise = null;
        this._built = false;
        this._building = null;
        this._hovered = null;
        this.tooltip = null;
    }

    // pre-aquece o pack do mapa (RoomScene.create) — abrir fica instantaneo
    preload() { this._movie(); }

    _movie() {
        if (!this._moviePromise) {
            this._moviePromise = MovieRoom.load('/assets/movies/map')
                .then((m) => m)
                .catch((e) => { console.warn('[islandmap] load', e); this._moviePromise = null; return null; });
        }
        return this._moviePromise;
    }

    setOpen(open) {
        this.open = open;
        if (open) this._ensureBuilt();
        if (this.container) this.container.setVisible(open);
        if (this.dim) this.dim.setVisible(open);
        if (!open) this._hoverOut();
    }

    async _ensureBuilt() {
        if (this._built || this._building) return this._building;
        this._building = (async () => {
            const movie = await this._movie();
            if (!movie || !this.scene.sys.isActive()) return;
            await this._build(movie);
            this._built = true;
        })();
        try { await this._building; } finally { this._building = null; }
        if (this.open) {
            this.container?.setVisible(true);
            this.dim?.setVisible(true);
        }
    }

    async _build(movie) {
        const scene = this.scene;
        const ss = SS_FIXED;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(760 * ss);
        canvas.height = Math.round(480 * ss);
        // primeiro render já no build: decodifica todos os SVGs do mapa e
        // deixa o primeiro hover sem custo de decode
        await movie.renderFrame(0, canvas, ss);

        this.dim = scene.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x000000, 0.25)
            .setDepth(19999998).setVisible(false);
        this.dim.on('pointerdown', () => this.scene.toggleMap());

        const cont = scene.add.container(0, 0).setDepth(19999999).setVisible(false);
        this.container = cont;

        const texKey = 'islandmap_main';
        if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
        scene.textures.addCanvas(texKey, canvas);
        this._tex = scene.textures.get(texKey);
        this._canvas = canvas;
        this._ss = ss;

        // stage inteiro desenhado com o transform do gp (origin + scale);
        // o que ficar fora da box aparece sobre o dim, como no original
        const img = scene.add.image(MAP_ORIGIN[0], MAP_ORIGIN[1], texKey)
            .setOrigin(0, 0).setScale(MAP_SCALE / ss);
        cont.add(img);

        // sem moldura extra: o map.swf ja traz o proprio frame branco da
        // janela (shape 1.svg) — um strokeRect na MAP_BOX criava um
        // retangulo branco separado, maior que a arte, visivel no fundo
        this.tooltip = new UiTooltip(scene, cont);
        this.movie = movie;

        // zonas dos botoes — bounds do hittest transformados p/ coords do mundo
        for (const b of movie.findButtons(0)) {
            const cfg = BUTTONS[b.path];
            if (!cfg) continue;
            const [x0, y0, x1, y1] = b.bounds;
            const cx = MAP_ORIGIN[0] + ((x0 + x1) / 2) * MAP_SCALE;
            const cy = MAP_ORIGIN[1] + ((y0 + y1) / 2) * MAP_SCALE;
            const w = Math.max((x1 - x0) * MAP_SCALE, 16);
            const h = Math.max((y1 - y0) * MAP_SCALE, 16);
            const zone = scene.add.zone(cx, cy, w, h)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => this._hoverIn(b, cx, cy, w, h));
            zone.on('pointerout', () => this._hoverOut());
            zone.on('pointerdown', () => {
                if (cfg.close) { this.scene.toggleMap(); return; }
                // otimista: mouse parado sobre o destino ja baixa e parseia
                // o pack da sala — o clique encontra tudo em memoria
                const base = this.scene._movieBaseFor?.(cfg.room);
                if (base) MovieRoom.load(base).catch(() => {});
                this.scene.toggleMap();
                this.scene.changeRoom(cfg.room);
            });
            cont.add(zone);
        }
    }

    // rollOver do map.swf: button 'over' + INTERFACE.showHint(this,key)
    async _hoverIn(btn, cx, cy, w, h) {
        if (this._hovered === btn.path) return;
        this._hoverOut();
        this._hovered = btn.path;
        const cfg = BUTTONS[btn.path];
        const movie = await this._movie();
        if (!movie || this._hovered !== btn.path || !this.open) return;
        movie.setButtonState(btn.path, 'over');
        this._render();
        const text = cfg?.hint ? HINTS[cfg.hint] : null;
        if (text) this.tooltip?.show(cx - w / 2, cy - h / 2, w, h, text);
    }

    // rollOut: button 'up' + INTERFACE.closeHint()
    _hoverOut() {
        const path = this._hovered;
        this._hovered = null;
        this.tooltip?.hide();
        if (!path) return;
        this._movie()?.then((m) => {
            if (m) { m.setButtonState(path, 'up'); this._render(); }
        });
    }

    // re-render do stage (botao over/up) — decode ja quente apos o build;
    // renders seguidos sobrescrevem (o ultimo estado vence no canvas)
    _render() {
        this._movie().then((m) => {
            if (!m || !this._canvas) return;
            m.renderFrame(0, this._canvas, this._ss).then(() => this._tex?.refresh());
        });
    }
}
