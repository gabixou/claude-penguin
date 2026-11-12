// IslandMap.js — mapa da ilha do Club Penguin (map.swf vetorial).
// Renderiza o frame principal do pacote /assets/movies/map via Clip e
// converte os botoes *_btn/labels em zonas clicaveis que chamam changeRoom.
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { WORLD_W, WORLD_H } from '../display.js';

const RENDER_SCALE = 2;
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// botao do mapa -> room key do MOVIE_ROOM_MAP
const BUTTON_ROOMS = {
    dock_btn: 'dock', beach_btn: 'beach', village_btn: 'village',
    mine_btn: 'shack', berg_btn: 'berg', cove_btn: 'cove',
    forest_btn: 'forest', fort_btn: 'forts', igloos_btn: 'lodge',
    rink_btn: 'rink', dojo_btn: 'dojoext', mtn_btn: 'mtn',
    // labels de idioma também são clicáveis no original
    langtown_mc: 'town', langplaza_mc: 'plaza',
};
// labels aninhados (town_btn/plaza_btn dentro dos lang*_mc) — approx. pelo label inteiro
const LABEL_ROOMS = { langtown_mc: 'town', langplaza_mc: 'plaza' };

export default class IslandMap {
    constructor(scene) {
        this.scene = scene;
        this.open = false;
        this.container = null;
        this.dim = null;
        this._moviePromise = null;
        this._built = false;
    }

    _movie() {
        if (!this._moviePromise) {
            this._moviePromise = MovieRoom.load('/assets/movies/map')
                .then((m) => { m.setScale(1); return m; })
                .catch((e) => { console.warn('[islandmap] load', e); return null; });
        }
        return this._moviePromise;
    }

    setOpen(open) {
        this.open = open;
        if (open) this._ensureBuilt();
        if (this.container) this.container.setVisible(open);
        if (this.dim) this.dim.setVisible(open);
    }

    async _ensureBuilt() {
        if (this._built) return;
        const movie = await this._movie();
        if (!movie || !this.scene.sys.isActive()) return;
        this._built = true;
        await this._build(movie);
        if (this.open) { this.container?.setVisible(true); this.dim?.setVisible(true); }
    }

    async _build(movie) {
        const scene = this.scene;
        const clip = new Clip(movie);
        const entries = movie.data.main?.frames?.[0] || [];

        const b = clip._boundsOf(entries, IDENT, '') || [0, 0, WORLD_W, WORLD_H];
        const bw = Math.ceil(b[2] - b[0]), bh = Math.ceil(b[3] - b[1]);
        const canvas = document.createElement('canvas');
        canvas.width = bw * RENDER_SCALE; canvas.height = bh * RENDER_SCALE;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, -b[0] * RENDER_SCALE, -b[1] * RENDER_SCALE);
        await clip._drawListFrame(ctx, entries, IDENT, '', IDENT_COLOR, RENDER_SCALE);

        const scale = Math.min(WORLD_W / bw, WORLD_H / bh); // preenche a tela
        const dw = bw * scale, dh = bh * scale;
        const ox = (WORLD_W - dw) / 2, oy = (WORLD_H - dh) / 2;

        this.dim = scene.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x000000, 0.45)
            .setDepth(19999999).setVisible(false);
        this.dim.on('pointerdown', () => this.scene.toggleMap());

        const cont = scene.add.container(0, 0).setDepth(20000000).setVisible(false);
        this.container = cont;

        const texKey = `islandmap_${Date.now()}`;
        scene.textures.addCanvas(texKey, canvas);
        cont.add(scene.add.image(ox, oy, texKey).setOrigin(0, 0).setDisplaySize(dw, dh));

        // zonas clicaveis sobre os botoes/labels do mapa
        for (const e of entries) {
            const room = BUTTON_ROOMS[e.name];
            if (!room) continue;
            const eb = clip._boundsOf([e], IDENT, '');
            if (!eb) continue;
            const bw2 = (eb[2] - eb[0]) * scale, bh2 = (eb[3] - eb[1]) * scale;
            const cx = ox + ((eb[0] + eb[2]) / 2 - b[0]) * scale;
            const cy = oy + ((eb[1] + eb[3]) / 2 - b[1]) * scale;
            const zone = scene.add.zone(cx, cy, Math.max(bw2, 18), Math.max(bh2, 18))
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                this.scene.toggleMap();
                this.scene.changeRoom(room);
            });
            // otimista: mouse parado sobre o destino (~120ms) ja baixa e
            // parseia o pack da sala — o clique encontra tudo em memoria
            let hoverT = null;
            zone.on('pointerover', () => {
                clearTimeout(hoverT);
                hoverT = setTimeout(() => {
                    const base = this.scene._movieBaseFor?.(room);
                    if (base) MovieRoom.load(base).catch(() => {});
                }, 120);
            });
            zone.on('pointerout', () => clearTimeout(hoverT));
            cont.add(zone);
        }

        // close_btn desenhado no mapa -> zona de fechamento
        const closeEntry = entries.find((e) => e.name === 'close_btn');
        if (closeEntry) {
            const eb = clip._boundsOf([closeEntry], IDENT, '');
            if (eb) {
                const cx = ox + ((eb[0] + eb[2]) / 2 - b[0]) * scale;
                const cy = oy + ((eb[1] + eb[3]) / 2 - b[1]) * scale;
                const zone = scene.add.zone(cx, cy, Math.max((eb[2] - eb[0]) * scale, 20), Math.max((eb[3] - eb[1]) * scale, 20))
                    .setInteractive({ useHandCursor: true });
                zone.on('pointerdown', () => this.scene.toggleMap());
                cont.add(zone);
            }
        }
    }
}
