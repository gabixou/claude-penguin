// NameChangeModal.js — rename do pinguim (uma única vez) usando o dialogo
// autentico `interface_mc.prompt_mc` frame 9 do interface.swf: a variante
// com campo de texto (text_input + continue_btn + close_btn + message_txt),
// o mesmo clip que o gp usa para prompts com input. O campo editavel e um
// <input> DOM posicionado sobre o text_input (mesmo esquema do chat input).
import { MovieRoom } from '../movie/movie.js';
import { WORLD_W, WORLD_H } from '../display.js';

const DEPTH = 30000000;
const PROMPT_PATH = 'interface_mc.prompt_mc';
const PROMPT_FRAME = 9; // frame com text_input/continue/close
const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const matVec = (m, x, y) => ({ x: m.a * x + m.c * y + m.x, y: m.b * x + m.d * y + m.y });
const arrMat = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });

export default class NameChangeModal {
    constructor(scene) {
        this.scene = scene;
        this.cont = null;
        this.username = '';
        this.usernameInput = null;
        this.infoText = null;
        this._moviePromise = null;
        this._gen = 0;
        this._opening = false;
        this._warmed = false;
        this._submitting = false;
        this._submitTimeout = null;
        this._continueZone = null;
        this._inputRect = null; // bounds mundo do text_input p/ layout do input
        this._texKey = null;
        this._avatarTexKey = null;
        this._iconAnchor = null; // posicao mundo do icon_mc (preview do pinguim)
        this._layoutBound = null;
    }

    get isOpen() { return !!this.cont; }

    // Mesmo MovieRoom do PromptUI/VectorHud (pack interface compartilhado).
    _ensureMovie() {
        if (!this._moviePromise) {
            this._moviePromise = (this.scene.game._interfaceMoviePromise
                || MovieRoom.load('/assets/movies/interface'))
                .then((m) => { m.setScale?.(1); return m; })
                .catch((e) => { console.warn('[rename] interface load', e); return null; });
        }
        return this._moviePromise;
    }

    async open() {
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
            this.username = scene.network?.username || '';
            this._build(movie);
        } finally {
            if (gen === this._gen) this._opening = false;
        }
    }

    close() {
        this._gen++;
        this._opening = false;
        if (this._submitTimeout) { clearTimeout(this._submitTimeout); this._submitTimeout = null; }
        this._submitting = false;
        this.usernameInput?.remove();
        this.usernameInput = null;
        if (this._layoutBound) { this.scene.scale?.off('resize', this._layoutBound); this._layoutBound = null; }
        if (this.cont) { this.cont.destroy(true); this.cont = null; }
        if (this._texKey && this.scene.textures.exists(this._texKey)) {
            this.scene.textures.remove(this._texKey);
        }
        if (this._avatarTexKey && this.scene.textures.exists(this._avatarTexKey)) {
            this.scene.textures.remove(this._avatarTexKey);
        }
        this._texKey = null;
        this._avatarTexKey = null;
        this._iconAnchor = null;
        this._continueZone = null;
        this._inputRect = null;
    }

    async _build(movie) {
        const scene = this.scene;
        const gen = this._gen;
        const ss = scene._ss || 2;

        // estado do prompt: frame 9 (input), textos dinamicos via editTexts
        movie.goto(PROMPT_PATH, PROMPT_FRAME);
        movie.set(`${PROMPT_PATH}.block_mc`, { visible: false });
        movie.set(`${PROMPT_PATH}.message_txt`, { text: '' });
        movie.set(`${PROMPT_PATH}.continue_txt`, { text: 'Save' });
        // text_input NAO recebe set({text}): com editTexts presente o draw
        // vira _drawEditText (so o texto, sem o SVG do campo branco).
        // Sem override o char 777.svg (caixa branca) renderiza sozinho e o
        // input DOM fica por cima. icon_mc fica visivel — e o icone
        // decorativo do dialog (esconde-lo deixava espaco vazio no topo).
        movie.collectInteractive();

        const btns = {};
        for (const name of ['continue_btn', 'close_btn', 'text_input']) {
            const b = movie.boundsFor(`${PROMPT_PATH}.${name}`);
            if (b) btns[name] = b;
        }

        // render do subtree prompt_mc num canvas full-stage (mesmo do PromptUI)
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
            // icone do dialog em coords de mundo (sem o ss do canvas)
            const wlog = matMul(arrMat(imEntry.matrix || ID), arrMat(pEntry.matrix || ID));
            this._iconAnchor = matVec(wlog, 381.4, 150);
        }
        if (gen !== this._gen || !scene.sys.isActive()) return;

        const texKey = `rename_ui_${Date.now()}`;
        this._texKey = texKey;
        this.scene.textures.addCanvas(texKey, canvas);
        const cont = this.scene.add.container(0, 0).setDepth(DEPTH);
        this.cont = cont;
        cont.add(this.scene.add.image(WORLD_W / 2, WORLD_H / 2, texKey)
            .setDisplaySize(WORLD_W, WORLD_H));
        this._addAvatar();

        // zona bloqueante fullscreen (embaixo dos botoes) — prompt e modal
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

        // instrucao acima do campo (message_txt do clip e multilinha e
        // centralizado — qualquer texto encosta na borda do campo branco)
        this.infoText = this.scene.add.text(WORLD_W / 2, 214, 'Enter your new name:', {
            fontFamily: "'gpf-195', Arial, sans-serif",
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);
        cont.add(this.infoText);

        // status/erro no gap entre o campo e o botao Save
        this.statusText = this.scene.add.text(WORLD_W / 2, 272, '', {
            fontFamily: "'gpf-195', Arial, sans-serif",
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);
        cont.add(this.statusText);

        // input DOM sobre o campo text_input (bounds em coords de mundo)
        this._inputRect = btns.text_input || null;
        this._buildInput();
        this._setInfo('');
    }

    // icon_mc do prompt e um container vazio no SWF (o original injeta um
    // icone via loadMovie). Preenchemos a area do topo com o avatar do
    // pinguim local — reusa o canvas ja renderizado, sem assets novos.
    _addAvatar() {
        const scene = this.scene;
        const lp = scene.localPlayer;
        const lib = lp?._lib, anchor = this._iconAnchor;
        if (!lp?._canvas || !lib || !anchor) return;
        const key = `rename_avatar_${Date.now()}`;
        scene.textures.addCanvas(key, lp._canvas);
        this._avatarTexKey = key;
        const s = Math.min(120 / lib.viewW, 100 / lib.viewH);
        const w = lib.viewW * s, h = lib.viewH * s;
        // pe da area do icone ~48px abaixo do centro, centralizado na janela
        const img = scene.add.image(anchor.x - w / 2, anchor.y + 48 - h, key)
            .setOrigin(0, 0).setDisplaySize(w, h);
        this.cont.add(img);
    }

    _buildInput() {
        const r = this._inputRect;
        if (!r) return;
        const scene = this.scene;
        const [x0, y0, x1, y1] = r;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.username;
        input.maxLength = 16;
        input.spellcheck = false;
        Object.assign(input.style, {
            position: 'fixed',
            border: 'none', outline: 'none',
            background: 'transparent',
            color: '#000000',
            fontFamily: "'gpf-195', Arial, sans-serif",
            zIndex: '100000',
            boxSizing: 'border-box',
            display: 'none',
        });
        input.addEventListener('input', () => { this.username = input.value; this._validate(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.stopPropagation(); this._submit(); }
            else if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
        });
        document.body.appendChild(input);
        this.usernameInput = input;
        this._layoutInput();
        this._layoutBound = () => this._layoutInput();
        scene.scale?.on('resize', this._layoutBound);
        input.focus();
        input.select();
        this._validate();
    }

    // posiciona o input DOM sobre o retangulo do text_input — canvas e
    // escalado via FIT, entao converte coords de mundo -> px de tela
    _layoutInput() {
        const input = this.usernameInput, r = this._inputRect;
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
        const trimmed = this.username?.trim() || '';
        return trimmed.length >= 3 && trimmed.length <= 16
            && trimmed !== this.scene.network?.username;
    }

    _submit() {
        if (this._submitting) return;
        if (!this._validate()) {
            this._setInfo('Invalid username (3-16 chars, must differ)', '#ffb0a0');
            return;
        }
        this._submitting = true;
        this._continueZone?.disableInteractive();
        this._setInfo('Saving…');
        this.scene.network?.renamePlayer(this.username.trim());
        this._submitTimeout = setTimeout(() => {
            this._submitting = false;
            this._continueZone?.enableInteractive();
            this._setInfo('Connection timeout. Try again.', '#ffb0a0');
        }, 10000);
    }

    onServerResponse(success, message = '') {
        this._submitting = false;
        if (this._submitTimeout) { clearTimeout(this._submitTimeout); this._submitTimeout = null; }
        this._continueZone?.enableInteractive();
        if (success) {
            this.close();
        } else {
            this._setInfo(message || 'Rename failed.', '#ffb0a0');
        }
    }
}
