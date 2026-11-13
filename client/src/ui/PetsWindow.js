// PetsWindow.js — lista de pets do jogador (INTERINO ate a Fase 3).
// No CP original os puffles moram no iglu; como o iglu ainda nao existe,
// o botao de iglu do HUD abre esta janela. O chrome visual reusa o
// background_mc + close_btn do buddy_mc.art_mc (sprite 502 do pack
// interface) — mesma janela azul dos dialogs originais. Cada linha
// mostra o icone original do puffle (/assets/puffle-icons/<cor>) + nome;
// clicar abre o PuffleCard. Seta "(walking)" no pet equipado.
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { WORLD_W, WORLD_H } from '../display.js';
import { puffleIconTexture, SPECIES_SPRITE } from '../entities/PuffleView.js';

const SCALE = 2;
const ROOT = [1, 0, 0, 1, 460, 80];   // matrix do buddy_mc no stage (mesma janela)
const ART_ID = '502';
const MAX_ROWS = 10;
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
const arrM = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });
const mulM = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const ROOT_M = arrM(ROOT);

export default class PetsWindow {
    constructor(scene) {
        this.scene = scene;
        this.open_ = false;
        this._ready = false;
        this._gen = 0;
        this.container = scene.add.container(0, 0).setDepth(15000000).setVisible(false);
        scene.events.on('social-update', () => { if (this.open_) this.render(); });
        scene.events.once('shutdown', () => this.destroy());
        this._init();
    }

    async _init() {
        try {
            if (!this.scene.game._interfaceMoviePromise) {
                this.scene.game._interfaceMoviePromise = MovieRoom.load('/assets/movies/interface')
                    .then((m) => { m.setScale?.(1); return m; });
            }
            const movie = await this.scene.game._interfaceMoviePromise;
            if (!movie || !this.scene.sys.isActive()) return;
            this.movie = movie;
            this.clip = new Clip(movie);
            this.sprites = movie.sprites || {};
            this.art = this.sprites[ART_ID]?.frames?.[0] || [];
            // desenha so background_mc + close_btn (chrome da janela)
            this.bgEntries = this.art.filter((e) =>
                e.name === 'background_mc' || e.name === 'close_btn');
            this._computeLayout();
            this._buildVisuals();
            this._ready = true;
            if (this.open_) this.render();
        } catch (e) {
            console.warn('[petswindow] init', e);
        }
    }

    _computeLayout() {
        const c = this.clip;
        const find = (n) => this.art.find((e) => e.name === n);
        this.elems = {};
        for (const n of ['title_txt', 'buddy_total_txt', 'close_btn', 'item0_mc', 'item1_mc']) {
            const e = find(n);
            this.elems[n] = e ? c._boundsOf([e], ROOT_M, '') : null;
        }
        // passo vertical entre linhas (item0->item1 = 26px)
        const r0 = this.elems.item0_mc, r1 = this.elems.item1_mc;
        this.rowH = r0 && r1 ? r1[1] - r0[1] : 26;
        this.rowX = r0 ? r0[0] + 18 : 480;   // depois do icone
    }

    _center(b) { return b ? { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 } : { x: 0, y: 0 }; }

    _buildVisuals() {
        const scene = this.scene;
        this.canvas = document.createElement('canvas');
        this.canvas.width = WORLD_W * SCALE;
        this.canvas.height = WORLD_H * SCALE;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        this.texKey = `petswin_${Date.now()}`;
        scene.textures.addCanvas(this.texKey, this.canvas);
        this.img = scene.add.image(0, 0, this.texKey)
            .setOrigin(0, 0).setDisplaySize(WORLD_W, WORLD_H);
        this.container.add(this.img);

        const mkText = (b, size = 13) => {
            const cc = this._center(b);
            const t = scene.add.text(cc.x, cc.y, '', {
                fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold',
                color: '#ffffff', stroke: '#1c3a5e', strokeThickness: 2,
            }).setOrigin(0.5);
            this.container.add(t);
            return t;
        };
        this.titleText = mkText(this.elems.title_txt, 15);
        this.totalText = mkText(this.elems.buddy_total_txt, 12);

        // linhas: icone + nome (recriadas por render)
        this.rows = [];
        for (let i = 0; i < MAX_ROWS; i++) {
            const y = this.elems.item0_mc ? this.elems.item0_mc[1] + this.rowH * i + this.rowH / 2 : 100 + i * 26;
            const icon = scene.add.image(this.elems.item0_mc ? this.elems.item0_mc[0] + 14 : 470, y, '__WHITE')
                .setDisplaySize(18, 18).setVisible(false);
            const name = scene.add.text(this.rowX, y, '', {
                fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold',
                color: '#ffffff', stroke: '#1c3a5e', strokeThickness: 2,
            }).setOrigin(0, 0.5);
            const zone = scene.add.zone(this.elems.item0_mc ? this.elems.item0_mc[0] + 10 : 460, y, 210, this.rowH - 4)
                .setInteractive({ useHandCursor: true });
            this.container.add([icon, name, zone]);
            this.rows.push({ icon, name, zone, pet: null });
        }

        // close
        const cb = this.elems.close_btn;
        if (cb) {
            const cc = this._center(cb);
            const z = scene.add.zone(cc.x, cc.y, Math.max(cb[2] - cb[0], 18), Math.max(cb[3] - cb[1], 14))
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', () => this.close());
            this.container.add(z);
        }
        this.container.setVisible(false);
    }

    async render() {
        if (!this._ready) return;
        const gen = ++this._gen;
        const pets = this.scene.network?.social?.pets || [];
        // redesenha a arte (background + close)
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        await this.clip._drawListFrame(this.ctx, this.bgEntries, ROOT_M, '', IDENT_COLOR, SCALE);
        if (gen !== this._gen) return;
        this.scene.textures.get(this.texKey)?.refresh();

        this.titleText.setText('Pets');
        this.totalText.setText(`${pets.length}`);

        // icones de puffle (lazy, cache por especie)
        const iconJobs = [];
        for (let i = 0; i < MAX_ROWS; i++) {
            const row = this.rows[i];
            const pet = pets[i] || null;
            row.pet = pet;
            if (!pet) {
                row.icon.setVisible(false);
                row.name.setText('');
                continue;
            }
            const label = pet.equipped ? `${pet.name} (walking)` : pet.name;
            row.name.setText(label);
            iconJobs.push(
                puffleIconTexture(this.scene, pet.species, 36).then((key) => {
                    if (gen !== this._gen || !row.pet) return;
                    if (key && this.scene.textures.exists(key)) {
                        row.icon.setTexture(key).setVisible(true);
                    }
                })
            );
            row.zone.off('pointerdown');
            row.zone.on('pointerdown', () => this._openPet(row.pet));
        }
        await Promise.all(iconJobs);
    }

    _openPet(pet) {
        if (!pet) return;
        this.scene.puffleCard?.open(pet);
    }

    toggle() {
        if (!this._ready) { if (!this.open_) this.open(); return; }
        this.open_ ? this.close() : this.open();
    }

    open() {
        this.open_ = true;
        this.container.setVisible(true);
        this.scene.network?.getSocial?.();
        this.render();
    }

    close() {
        this.open_ = false;
        this.container.setVisible(false);
    }

    destroy() {
        this._gen++;
        this.container?.destroy(true);
    }
}
