// PuffleCard.js — card do pet, port do openPuffle do gopenguin:
// renderiza interface_mc.widgets_mc.puffle_mc.art_mc (sprite 597 do pack
// interface) via Clip. Frame 1 = stats (play/rest/feed/walk), frame 2 =
// painel de cuidado (gum/cookie/food/bath). paper_mc mostra o puffle
// (frame = tipo+1), stats_mc tem barras hunger/health/rest (frame 1-10).
// name_txt e texto dinamico sobreposto (caractere 'text' do SWF).
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { WORLD_W, WORLD_H } from '../display.js';
import { SPECIES_TYPE } from '../entities/PuffleView.js';

const ART_ID = '597';       // sprite do art_mc (conteudo do card)
const SCALE = 2;
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// botoes de cuidado (frame 2) -> acao PET_CARE do server
const CARE_ACTIONS = {
    gum_btn: 'feed', cookie_btn: 'feed', food_btn: 'feed', bath_btn: 'rest',
};

export default class PuffleCard {
    constructor(scene) {
        this.scene = scene;
        this.pet = null;        // {petRowId, species, name, hunger, ...}
        this.care = false;      // painel de cuidado aberto (frame 2)
        this.container = null;
        this._ready = false;
        this._gen = 0;
        scene.events.on('social-update', () => { if (this.pet) this._syncPet(); });
        scene.events.once('shutdown', () => this.destroy());
        this._init();
    }

    get isOpen() { return !!this.container; }

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
            this._frames = this.sprites[ART_ID]?.frames || [];
            // bounds do card (frame 1) em coords locais do art_mc
            this.cardBounds = this.clip._boundsOf(this._frames[0] || [], IDENT, '') || [0, 0, 244, 340];
            this._buildDom();
            this._ready = true;
        } catch (e) {
            console.warn('[pufflecard] init', e);
        }
    }

    _buildDom() {
        // canvas full-stage (mesmo esquema do BuddyWindow) — desenha so o
        // card, centralizado horizontalmente na area util da sala
        this.canvas = document.createElement('canvas');
        this.canvas.width = WORLD_W * SCALE;
        this.canvas.height = WORLD_H * SCALE;
        this.ctx = this.canvas.getContext('2d');
        this.texKey = `pufflecard_${Date.now()}`;
        this.scene.textures.addCanvas(this.texKey, this.canvas);
        this.img = this.scene.add.image(0, 0, this.texKey)
            .setOrigin(0, 0).setDisplaySize(WORLD_W, WORLD_H);
        this.container = this.scene.add.container(0, 0)
            .setDepth(16000000).setVisible(false);
        this.container.add(this.img);
        // nome do pet sobre name_txt
        this.nameText = this.scene.add.text(0, 0, '', {
            fontFamily: "'gpf-195', Arial, sans-serif",
            fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
            stroke: '#1c3a5e', strokeThickness: 2,
        }).setOrigin(0.5);
        this.container.add(this.nameText);
    }

    // pet: linha de network.social.pets; species p/ frame do paper_mc
    open(pet) {
        if (!this._ready || !pet) return;
        this.pet = pet;
        this.care = false;
        this.container.setVisible(true);
        this.scene.catalogue && (this.scene.catalogue._prompt?.close?.());
        this._syncPet();
    }

    close() {
        this.pet = null;
        this.care = false;
        this.container?.setVisible(false);
        this._gen++;
    }

    toggle() { this.pet ? this.close() : null; }

    // dados frescos do social state (stats decaem no server)
    _syncPet() {
        const fresh = (this.scene.network?.social?.pets || [])
            .find((p) => p.petRowId === this.pet?.petRowId);
        if (fresh) this.pet = { ...this.pet, ...fresh };
        this._render();
    }

    _barFrame(stat) {
        return Math.max(1, Math.min(10, Math.round((stat ?? 100) / 10)));
    }

    async _render() {
        if (!this.pet || !this._ready) return;
        const gen = ++this._gen;
        const c = this.clip;
        const frameIdx = this.care ? 1 : 0;
        const entries = this._frames[frameIdx] || this._frames[0] || [];
        // esconde textos/elementos dinâmicos que serao sobrepostos
        c.set('name_txt', { visible: false });
        // paper_mc: frame = tipo+1 (ordem gp dos puffles); clamp p/ 9 frames
        const type = Math.min(SPECIES_TYPE[this.pet.species] ?? 0, 8);
        c.set('paper_mc', { frame: type + 1 });
        // barras de stats: sprite 526, frame 1-10
        const p = this.pet;
        c.set('stats_mc.hunger_mc', { frame: this._barFrame(p.hunger) });
        c.set('stats_mc.health_mc', { frame: this._barFrame(p.happiness) });
        c.set('stats_mc.rest_mc', { frame: this._barFrame(p.rest ?? 100) });
        // redesenha
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        await c._drawListFrame(ctx, entries, IDENT, '', IDENT_COLOR, SCALE);
        if (gen !== this._gen) return;
        this.scene.textures.get(this.texKey)?.refresh();

        // posiciona o card: centralizado na tela (bounds do arte em stage)
        const b = this.cardBounds;
        const cx = WORLD_W / 2, cy = WORLD_H / 2 - 10;
        const ox = cx - (b[0] + b[2]) / 2, oy = cy - (b[1] + b[3]) / 2;
        // name_txt: bounds do elemento no frame ativo
        const nameEntry = entries.find((e) => e.name === 'name_txt');
        if (nameEntry) {
            const nb = c._boundsOf([nameEntry], IDENT, '');
            if (nb) {
                this.nameText.setPosition(
                    (nb[0] + nb[2]) / 2 + ox, (nb[1] + nb[3]) / 2 + oy);
            }
        }
        this.nameText.setText(this.pet.name || '');
        this._syncZones(entries, ox, oy);
    }

    _syncZones(entries, ox, oy) {
        for (const z of this._zones || []) z.destroy();
        this._zones = [];
        const c = this.clip;
        const zone = (entry, fn) => {
            if (!entry) return;
            const b = c._boundsOf([entry], IDENT, '');
            if (!b) return;
            const w = Math.max(b[2] - b[0], 16), h = Math.max(b[3] - b[1], 16);
            const z = this.scene.add.zone(
                (b[0] + b[2]) / 2 + ox, (b[1] + b[3]) / 2 + oy, w, h)
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', () => {
                this.scene._pcardClosedAt = this.scene.time?.now ?? 0;
                fn();
            });
            this.container.add(z);
            this._zones.push(z);
        };
        const find = (n) => entries.find((e) => e.name === n);
        zone(find('close_btn'), () => this.close());
        zone(find('walk_btn'), () => this._walk());
        zone(find('play_btn'), () => this._care('play'));
        zone(find('rest_btn'), () => this._care('rest'));
        // feed_btn e tab_btn abrem/fecham o painel de cuidado (como no gp)
        const toggleCare = () => { this.care = !this.care; this._render(); };
        zone(find('feed_btn'), toggleCare);
        zone(find('tab_btn'), toggleCare);
        if (this.care) {
            for (const [n, act] of Object.entries(CARE_ACTIONS)) {
                zone(find(n), () => this._care(act));
            }
        }
    }

    _walk() {
        const pet = this.pet;
        if (!pet?.petRowId) return;
        this.scene.network?.petEquip(pet.petRowId);
        // resposta via SOCIAL_UPDATE -> _syncPet re-renderiza (walk_btn
        // mostra "Stop walking" quando equipped — label e tooltip no gp,
        // aqui o estado visual do botao ja alterna pelo frame do sprite)
    }

    _care(action) {
        const pet = this.pet;
        if (!pet?.petRowId) return;
        this.scene.network?.petCare(pet.petRowId, action);
        // feedback: stats atualizam no proximo SOCIAL_UPDATE;
        // erro de cooldown cai no handler global net-error (chat)
    }

    destroy() {
        this._gen++;
        this.container?.destroy(true);
        this.container = null;
    }
}
