// PetNameModal.js — nomeacao do puffle na adocao, usando o dialogo
// autentico `interface_mc.prompt_mc` frame 9 (o mesmo que o gp usa em
// adoptPuffle): icon_mc recebe o icone do puffle, message_txt =
// "Name your puffle:", continue_txt = "Continue". Input DOM sobre o
// text_input (mesmo esquema do NameChangeModal).
import { MovieRoom } from '../movie/movie.js';
import { WORLD_W, WORLD_H } from '../display.js';
import { SPECIES_SPRITE } from '../entities/PuffleView.js';

const DEPTH = 30000000;
const PROMPT_PATH = 'interface_mc.prompt_mc';
const PROMPT_FRAME = 9;
const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const arrMat = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });

// cache de MovieRoom dos icones /assets/puffle-icons/<cor> — vetorial
// (SVGs), desenhado direto no canvas do prompt em vez de rasterizar
const _iconMovies = new Map();
function puffleIconMovie(dir) {
    if (!_iconMovies.has(dir)) {
        _iconMovies.set(dir, MovieRoom.load(`/assets/puffle-icons/${dir}`)
            .then((m) => { m.setScale?.(1); return m; })
            .catch((e) => { console.warn('[petname] icon', dir, e); _iconMovies.delete(dir); return null; }));
    }
    return _iconMovies.get(dir);
}

// validacao identica ao gp: /^[A-Za-z0-9 ]{1,12}$/ no nome trimado
const NAME_RE = /^[A-Za-z0-9 ]{1,12}$/;

export default class PetNameModal {
    constructor(scene) {
        this.scene = scene;
        this.cont = null;
        this.species = null;
        this.name = '';
        this.nameInput = null;
        this.statusText = null;
        this._moviePromise = null;
        this._gen = 0;
        this._opening = false;
        this._warmed = false;
        this._submitting = false;
        this._submitTimeout = null;
        this._continueZone = null;
        this._inputRect = null;
        this._texKey = null;
        this._layoutBound = null;
        this._onAdopted = null; // callback(name) apos SOCIAL_UPDATE confirmar
        this._errHandler = null;
    }

    get isOpen() { return !!this.cont; }

    _ensureMovie() {
        if (!this._moviePromise) {
            this._moviePromise = (this.scene.game._interfaceMoviePromise
                || MovieRoom.load('/assets/movies/interface'))
                .then((m) => { m.setScale?.(1); return m; })
                .catch((e) => { console.warn('[petname] interface load', e); return null; });
        }
        return this._moviePromise;
    }

    // species: id do PET_SPECIES (ex.: 'puffle_blue'); onDone(name) apos adocao
    async open(species, onDone) {
        if (this.isOpen || this._opening) return;
        this._opening = true;
        const gen = ++this._gen;
        try {
            const scene = this.scene;
            scene.chatInputRef?.blur?.();
            const movie = await this._ensureMovie();
            if (gen !== this._gen || !movie || !scene.sys.isActive()) return;
            if (!this._warmed) { movie.warmPlayheads?.(); this._warmed = true; }
            await movie.ensureFonts();
            if (gen !== this._gen || !scene.sys.isActive()) return;
            this.species = species;
            this.name = '';
            this._onAdopted = onDone || null;
            this._build(movie);
        } finally {
            if (gen === this._gen) this._opening = false;
        }
    }

    close() {
        this._gen++;
        this._opening = false;
        this._cleanupSubmit();
        if (this._socialHandler) {
            this.scene.events?.off('social-update', this._socialHandler);
            this._socialHandler = null;
        }
        this.nameInput?.remove();
        this.nameInput = null;
        if (this._layoutBound) { this.scene.scale?.off('resize', this._layoutBound); this._layoutBound = null; }
        if (this.cont) { this.cont.destroy(true); this.cont = null; }
        for (const k of [this._texKey]) {
            if (k && this.scene.textures.exists(k)) this.scene.textures.remove(k);
        }
        this._texKey = null;
        this._continueZone = null;
        this._inputRect = null;
    }

    _cleanupSubmit() {
        this._submitting = false;
        if (this._submitTimeout) { clearTimeout(this._submitTimeout); this._submitTimeout = null; }
        if (this._errHandler) {
            this.scene.events?.off('net-error', this._errHandler);
            this._errHandler = null;
        }
    }

    // SOCIAL_UPDATE com pet novo na lista = adocao confirmada -> fecha e
    // avisa o fluxo (RoomScene mostra "X is waiting in your igloo.")
    _watchAdoption(petsBefore, name) {
        const h = () => {
            const pets = this.scene.network?.social?.pets || [];
            if (pets.length <= petsBefore) return;
            this.scene.events?.off('social-update', h);
            this._socialHandler = null;
            const cb = this._onAdopted;
            this.close();
            cb?.(name);
        };
        this._socialHandler = h;
        this.scene.events?.on('social-update', h);
    }

    async _build(movie) {
        const scene = this.scene;
        const gen = this._gen;
        const ss = scene._ss || 2;

        movie.goto(PROMPT_PATH, PROMPT_FRAME);
        movie.set(`${PROMPT_PATH}.block_mc`, { visible: false });
        movie.set(`${PROMPT_PATH}.message_txt`, { text: '' });
        movie.set(`${PROMPT_PATH}.continue_txt`, { text: 'Continue' });
        movie.collectInteractive();

        const btns = {};
        for (const name of ['continue_btn', 'close_btn', 'text_input', 'icon_mc']) {
            const b = movie.boundsFor(`${PROMPT_PATH}.${name}`);
            if (b) btns[name] = b;
        }

        const cw = Math.round(WORLD_W * ss), ch = Math.round(WORLD_H * ss);
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        const mainFrame = movie._mainTl.frames[movie._mainFrame - 1] || movie._mainTl.frames[0] || [];
        const imEntry = mainFrame.find((e) => e.name === 'interface_mc');
        const imFrame = imEntry && movie.sprites?.[String(imEntry.id)]?.frames?.[0] || [];
        const pEntry = imFrame.find((e) => e.name === 'prompt_mc');
        if (pEntry) {
            const world = matMul(
                matMul({ a: ss, b: 0, c: 0, d: ss, x: 0, y: 0 }, arrMat(imEntry.matrix || ID)),
                arrMat(pEntry.matrix || ID));
            const h = movie._playhead(PROMPT_PATH, String(pEntry.id));
            const pFrame = h ? (h.tl.frames[h.frame - 1] || []) : [];
            await movie._drawEntries(ctx, pFrame, world, PROMPT_PATH, IDENT_COLOR, ss, 1);
        }
        // icone do puffle VETORIZADO dentro do icon_mc: desenha os SVGs do
        // pack /assets/puffle-icons/<cor> direto no canvas do prompt (ss=2)
        // — antes era um raster 72px (puffleIconTexture) que ficava borrado.
        // icon_mc e um container VAZIO (alvo de loadMovie no original):
        // boundsFor retorna null — a ancora sai da matrix do node.
        const iconDir = SPECIES_SPRITE[this.species];
        const iconNode = movie._nodes?.get('interface_mc.prompt_mc.icon_mc');
        if (iconDir && iconNode) {
            const im = await puffleIconMovie(iconDir);
            if (im && gen === this._gen) {
                const ientries = im._mainTl?.frames?.[0] || [];
                const bb = im._boundsOfEntries(ientries, ID, '');
                if (bb) {
                    // node.matrix ja e objeto {a,b,c,d,x,y} (matrix do pai);
                    // entry.matrix e array — compoe pai*local = mundo do icon_mc
                    const w = matMul(iconNode.matrix || ID,
                        arrMat(iconNode.entry?.matrix || ID));
                    const s = 52 / Math.max(1, bb[3] - bb[1]); // ~52 un de altura
                    const W = {
                        a: s, b: 0, c: 0, d: s,
                        x: w.x - s * (bb[0] + bb[2]) / 2,
                        y: w.y - s * (bb[1] + bb[3]) / 2,
                    };
                    ctx.save();
                    ctx.setTransform(ss, 0, 0, ss, 0, 0); // canvas px = mundo*ss
                    await im._drawEntries(ctx, ientries, W, '', IDENT_COLOR, ss * 2, 1);
                    ctx.restore();
                }
            }
        }
        if (gen !== this._gen || !scene.sys.isActive()) return;

        const texKey = `petname_ui_${Date.now()}`;
        this._texKey = texKey;
        this.scene.textures.addCanvas(texKey, canvas);
        const cont = this.scene.add.container(0, 0).setDepth(DEPTH);
        this.cont = cont;
        cont.add(this.scene.add.image(WORLD_W / 2, WORLD_H / 2, texKey)
            .setDisplaySize(WORLD_W, WORLD_H));

        const swallow = this.scene.add.zone(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H)
            .setInteractive({ useHandCursor: false });
        cont.addAt(swallow, 0);

        const mkBtn = (name, cb) => {
            const b = btns[name];
            if (!b) return null;
            const [x0, y0, x1, y1] = b;
            const z = this.scene.add.zone((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0)
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', () => {
                this.scene._promptClosedAt = this.scene.time?.now ?? 0;
                cb?.();
            });
            cont.add(z);
            return z;
        };
        this._continueZone = mkBtn('continue_btn', () => this._submit());
        mkBtn('close_btn', () => this.close());

        // instrucao acima do campo — message_txt do clip e editText
        // multilinha que encosta na borda do campo branco; overlay Phaser
        // como no NameChangeModal ("Enter your new name:")
        this.infoText = this.scene.add.text(WORLD_W / 2, 214, 'Name your puffle:', {
            fontFamily: "'gpf-195', Arial, sans-serif",
            fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center',
        }).setOrigin(0.5);
        cont.add(this.infoText);

        this.statusText = this.scene.add.text(WORLD_W / 2, 272, '', {
            fontFamily: "'gpf-195', Arial, sans-serif",
            fontSize: '11px', fontStyle: 'bold', color: '#ffffff', align: 'center',
        }).setOrigin(0.5);
        cont.add(this.statusText);

        this._inputRect = btns.text_input || null;
        this._buildInput();
        this._setInfo('');
    }

    _buildInput() {
        const r = this._inputRect;
        if (!r) return;
        const scene = this.scene;
        const [x0, y0, x1, y1] = r;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '';
        input.maxLength = 12;
        input.spellcheck = false;
        Object.assign(input.style, {
            position: 'fixed', border: 'none', outline: 'none',
            background: 'transparent', color: '#000000',
            fontFamily: "'gpf-195', Arial, sans-serif",
            zIndex: '100000', boxSizing: 'border-box', display: 'none',
        });
        input.addEventListener('input', () => { this.name = input.value; this._validate(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.stopPropagation(); this._submit(); }
            else if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
        });
        document.body.appendChild(input);
        this.nameInput = input;
        this._layoutInput();
        this._layoutBound = () => this._layoutInput();
        scene.scale?.on('resize', this._layoutBound);
        input.focus();
        this._validate();
    }

    _layoutInput() {
        const input = this.nameInput, r = this._inputRect;
        if (!input || !r) return;
        const rect = this.scene.game.canvas.getBoundingClientRect();
        const sx = rect.width / WORLD_W, sy = rect.height / WORLD_H;
        const [x0, y0, x1, y1] = r;
        Object.assign(input.style, {
            display: 'block',
            left: (rect.left + x0 * sx + 8) + 'px',
            top: (rect.top + y0 * sy + 3) + 'px',
            width: Math.max(40, (x1 - x0) * sx - 16) + 'px',
            height: Math.max(18, (y1 - y0) * sy - 6) + 'px',
            fontSize: Math.max(12, 20 * sy) + 'px',
        });
    }

    _setInfo(msg, color = '#ffffff') {
        if (this.statusText) this.statusText.setText(msg).setColor(color);
    }

    _validate() {
        return NAME_RE.test((this.name || '').trim());
    }

    _submit() {
        if (this._submitting) return;
        const clean = (this.name || '').trim();
        if (!NAME_RE.test(clean)) {
            this._setInfo('Use 1–12 letters or numbers.', '#ffb0a0');
            return;
        }
        this._submitting = true;
        const petsBefore = (this.scene.network?.social?.pets || []).length;
        this._continueZone?.disableInteractive();
        this._setInfo('Adopting…');
        // erro do server (coins insuficientes, nome filtrado, etc.)
        this._errHandler = (d) => {
            this._submitting = false;
            this._continueZone?.enableInteractive();
            this._setInfo(d?.message || d?.code || 'Adoption failed.', '#ffb0a0');
            if (this._errHandler) { this.scene.events?.off('net-error', this._errHandler); this._errHandler = null; }
        };
        this.scene.events?.on('net-error', this._errHandler);
        this.scene.network?.petAdopt(this.species, clean);
        this._watchAdoption(petsBefore, clean);
        this._submitTimeout = setTimeout(() => {
            this._submitting = false;
            this._continueZone?.enableInteractive();
            this._setInfo('Connection timeout. Try again.', '#ffb0a0');
        }, 10000);
        // confirmacao via social-update esta em _cleanupSubmit -> _onAdopted
    }
}
