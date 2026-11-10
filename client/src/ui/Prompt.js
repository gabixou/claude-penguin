// Prompt.js — dialogo de confirmacao/aviso autentico: renderiza o clip real
// `interface_mc.prompt_mc` do interface.swf (o mesmo que o gp usa em
// INTERFACE.notice): frame 2 = Yes/No, frame 4 = Okay. Textos dinamicos via
// editTexts (fontes Burbank do SWF), botoes com bounds reais do button record.
import { MovieRoom } from '../movie/movie.js';
import { WORLD_W, WORLD_H } from '../display.js';

const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const arrMat = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });

export class PromptUI {
    constructor(scene) {
        this.scene = scene;
        this.movie = null;
        this.cont = null;
        this._warmed = false;
        this._gen = 0;
    }

    get isOpen() { return !!this.cont; }

    // Reusa o MovieRoom do VectorHud quando ja carregado (mesmo pack,
    // estado isolado — Clip usa estado proprio). Fallback: load proprio.
    async _ensureMovie() {
        if (!this.movie) {
            this.movie = await (this.scene.game._interfaceMoviePromise
                || MovieRoom.load('/assets/movies/interface'));
            if (!this._warmed) { this.movie.warmPlayheads?.(); this._warmed = true; }
            await this.movie.ensureFonts();
        }
        return this.movie;
    }

    // mode 'yesno' -> frame 2 (Yes/No); 'ok' -> frame 4 (Okay)
    async show({ text, mode = 'yesno', onYes, onNo }) {
        this.close();
        const gen = ++this._gen;
        const movie = await this._ensureMovie();
        if (gen !== this._gen || !movie || !this.scene.sys.isActive()) return;

        const frame = mode === 'yesno' ? 2 : 4;
        movie.goto('interface_mc.prompt_mc', frame);
        movie.set('interface_mc.prompt_mc.block_mc', { visible: false });
        movie.set('interface_mc.prompt_mc.message_txt', { text: String(text ?? '') });
        if (mode === 'yesno') {
            movie.set('interface_mc.prompt_mc.yes_txt', { text: 'Yes' });
            movie.set('interface_mc.prompt_mc.no_txt', { text: 'No' });
        } else {
            movie.set('interface_mc.prompt_mc.ok_txt', { text: 'Okay' });
        }

        // bounds dos botoes (coords de mundo 760x480) — collectInteractive
        // constroi o mapa de nodes no frame atual do prompt
        movie.collectInteractive();
        const btns = {};
        for (const name of ['yes_btn', 'no_btn', 'ok_btn']) {
            const b = movie.boundsFor(`interface_mc.prompt_mc.${name}`);
            if (b) btns[name] = b;
        }

        // render do subtree prompt_mc num canvas full-stage
        const ss = this.scene._ss || 2;
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
            const h = movie._playhead('interface_mc.prompt_mc', String(pEntry.id));
            const pFrame = h ? (h.tl.frames[h.frame - 1] || []) : [];
            await movie._drawEntries(ctx, pFrame, world, 'interface_mc.prompt_mc', IDENT_COLOR, ss, 1);
        }
        if (gen !== this._gen) return;

        const texKey = `prompt_ui_${Date.now()}`;
        this.scene.textures.addCanvas(texKey, canvas);
        const cont = this.scene.add.container(0, 0).setDepth(21000001);
        this.cont = cont;
        cont.add(this.scene.add.image(WORLD_W / 2, WORLD_H / 2, texKey)
            .setDisplaySize(WORLD_W, WORLD_H));

        // zona bloqueante fullscreen: prompt e modal — cliques fora nao
        // passam para a sala (adicionada primeiro = fica embaixo dos botoes)
        const swallow = this.scene.add.zone(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H)
            .setInteractive({ useHandCursor: false });
        cont.addAt(swallow, 0);

        const mkBtn = (name, cb) => {
            const b = btns[name];
            if (!b) return;
            const [x0, y0, x1, y1] = b;
            const z = this.scene.add.zone((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0)
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', () => {
                // marca o fechamento: o pointerdown da cena pode processar
                // depois deste evento e "vazar" o clique para o catalogo
                this.scene._promptClosedAt = this.scene.time?.now ?? 0;
                this.close(); cb?.();
            });
            cont.add(z);
        };
        if (mode === 'yesno') {
            mkBtn('yes_btn', onYes);
            mkBtn('no_btn', onNo);
        } else {
            mkBtn('ok_btn', onYes);
        }
    }

    close() {
        this._gen++;
        if (this.cont) { this.cont.destroy(true); this.cont = null; }
    }
}
