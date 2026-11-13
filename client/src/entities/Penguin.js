/**
 * Penguin.js - Pinguim Club Penguin vetorial (GoPenguin /swf/penguin/)
 * - Renderiza via PenguinView (Clip do timelines.json + SVGs em alta resolucao)
 * - 76 frames da timeline principal: idle 1-8, walk 9-16, sit 17-24,
 *   wave 25, dance 26, throw 27-30 (por direcao), demais emotes 31+
 * - Roupa: clothing/sprites/<id> desenhados na ordem feet->head
 * - Depth sorting dinamico (actor_depth = 901 + idx + 1000*floor(y), como o main.c)
 */

import Phaser from 'phaser';
import { PenguinView, bubbleArt, bubbleLines } from './PenguinArt.js';
import { colorItemToRgb, DEFAULT_COLOR_ITEM_ID } from '../items/colors.js';

let penguinSerial = 0; // desempate de depth (equivalente ao index do actor_depth do cliente C)

// Frames dos emotes na timeline principal do penguin.swf
const EMOTE_FRAMES = { wave: 25, dance: 26 };

export default class Penguin extends Phaser.GameObjects.Container {
    constructor(scene, x, y, playerId, username = null, colorItemId = DEFAULT_COLOR_ITEM_ID, isLocal = false) {
        super(scene, x, y);
        this.scene = scene;
        this._sceneRef = scene; // referência estável para callbacks async
        this.playerId = playerId;
        this.username = username || playerId;
        this.depthSerial = penguinSerial++ % 64;
        this.colorItemId = colorItemId;
        this.penguinColor = colorItemToRgb(colorItemId);
        this.isLocal = isLocal;
        this.isMoving = false;
        this.moveTween = null;
        this.moveTarget = null;
        this.facingRight = true;
        this.direction = 1;
        this.action = 1;          // frame logico (1..76)
        this.clock = 0;
        this._lastFrame = 0;
        this._rendering = false;
        this._needsRender = true;
        this._ss = 0;

        // Renderer vetorial (biblioteca carregada pela RoomScene/BootScene)
        this.view = null;
        this.sprite = null;
        this._initView(this.penguinColor);

        // 3. Nametag abaixo dos pés — escura e em negrito, como no original
        this.nameTag = scene.add.text(0, 16, this.username, {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '11px',
            color: '#000000',
            stroke: '#ffffff',
            strokeThickness: 0,
            align: 'center'
        }).setOrigin(0.5, 0);
        this.add(this.nameTag);

        // 4. Balão de chat
        this.chatBubble = scene.add.container(0, -78);
        this.chatBubble.setVisible(false);
        this.add(this.chatBubble);

        scene.add.existing(this);
        this.updateDepth();

        // Avanco dos sub-playheads + redraw (~24fps como o frameRate do SWF)
        this.animTimer = scene.time.addEvent({
            delay: 1000 / 24,
            loop: true,
            callback: () => {
                this.clock++;
                if (this.view) {
                    this.view.advance();
                    this._render();
                }
            }
        });
    }

    async _initView(color) {
        const lib = await this.scene.penguinLibrary;
        const scene = this._sceneRef;
        if (!lib || this.destroyed || !scene || !scene.sys?.isActive()) return;
        this._lib = lib;
        this.view = new PenguinView(lib, color);
        this.view.setLook(this.gpaOutfit || {}, this._viewScale());
        // anel de selecao azul (#3399ff) so no jogador local — como no original
        if (this.isLocal) this.view.art.set('ring', { visible: true });

        const b = lib.bounds;
        const w = lib.viewW, h = lib.viewH;
        const ss = this._viewScale();
        this._canvas = document.createElement('canvas');
        this._canvas.width = Math.ceil(w * ss);
        this._canvas.height = Math.ceil(h * ss);
        const texKey = `penguin_view_${this.playerId}_${++penguinSerial}`;
        scene.textures.addCanvas(texKey, this._canvas);
        this.sprite = scene.add.image(b.x0, b.y0, texKey)
            .setOrigin(0, 0)
            .setDisplaySize(w, h);
        this.add(this.sprite);
        this._texKey = texKey;
        this._render();
    }

    // ---------- Animação (frames da timeline principal) ----------

    setAction(a) {
        let frame;
        if (typeof a === 'string') {
            if (a === 'idle') frame = this.direction;
            else if (a === 'walk') frame = this.direction + 8;
            else if (a === 'sit') frame = this.direction + 16;
            else if (a === 'throw') frame = 26 + Math.round(this.direction / 2);
            else frame = EMOTE_FRAMES[a] || this.direction;
        } else {
            frame = a;
        }
        if (frame !== this.action) {
            this.action = frame;
            this.clock = 0;
            if (this.view) { this.view.setFrame(frame); this._render(); }
        }
    }

    setDirection(dir) {
        this.direction = ((dir % 8) + 8) % 8 + 1;
    }

    // Direcao (1-8) em direcao a um ponto — mesmos passos de 45° do original.
    directionToward(x, y) {
        const d = Math.round((Math.atan2(y - this.y, x - this.x) * 180 / Math.PI - 90) / 45);
        return ((d % 8) + 8) % 8 + 1;
    }

    // "Olhar" para o cursor: quando parado, o pinguim gira no proprio eixo
    // (troca o frame idle 1-8, ou senta na direcao 17-24) sempre de frente
    // para o ponteiro — igual ao Club Penguin original. Nao gira em emote.
    facePoint(x, y) {
        if (this.isMoving || !this.view) return;
        // sentado (frames 17-24 = dir+16) tambem gira pro cursor, mantendo
        // a pose sentada — no original o pinguim sentaba olhando o mouse
        const sitting = this.action >= 17 && this.action <= 24;
        if (this.action !== this.direction && !sitting) return; // emote: nao gira
        const dir = this.directionToward(x, y);
        if (dir !== this.direction) {
            this.direction = dir;
            this.setAction(sitting ? dir + 16 : dir); // frame idle/sentado da nova direcao
        }
    }

    sit() { this.setAction(this.direction + 16); }
    stand() { this.setAction(this.direction); }
    playEmote(name) { this.setAction(name); }

    setPenguinColor(color) {
        this.penguinColor = color;
        if (this.view) { this.view.setColor(color); this._render(); }
    }

    // Define cor via colorItemId (items.json type 1) - escalável para novos itens
    setColorItemId(itemId) {
        this.colorItemId = itemId;
        this.setPenguinColor(colorItemToRgb(itemId));
    }

    // Fator de raster do canvas do pinguim. As salas desenham com matrix
    // ss*m + scale ss -> shapes rasterizam a ~ss^2 (~5x) e sao downsampliados.
    // Aqui world=IDENT, entao eff = scale; usar ss^2 iguala a densidade
    // (e faz o pinguim dividir o mesmo cache artCanvas/tintedCanvas das salas).
    _viewScale() {
        const ss = this._sceneRef?._ss || 1;
        return ss * ss;
    }

    // Renderiza o frame atual no canvas da textura (assincrono, coalescido).
    _render() {
        const scene = this._sceneRef;
        if (!this.view || !this._canvas || this._rendering || !scene) {
            this._needsRender = true;
            return;
        }
        const ss = this._viewScale();
        if (ss !== this._ss) {
            // supersampling mudou: redimensiona o canvas
            this._ss = ss;
            const b = this._lib.bounds;
            const w = this._lib.viewW, h = this._lib.viewH;
            this._canvas.width = Math.ceil(w * ss);
            this._canvas.height = Math.ceil(h * ss);
            if (this.sprite && b) {
                this.sprite.setPosition(b.x0, b.y0).setDisplaySize(w, h);
            }
            if (scene.textures.exists(this._texKey)) scene.textures.get(this._texKey).refresh();
        }
        this._rendering = true;
        const ctx = this._canvas.getContext('2d');
        const b = this._lib.bounds;
        ctx.setTransform(ss, 0, 0, ss, -b.x0 * ss, -b.y0 * ss);
        ctx.clearRect(b.x0, b.y0, this._canvas.width / ss, this._canvas.height / ss);
        this.view.render(ctx, ss)
            .then(() => {
                if (scene.textures.exists(this._texKey)) scene.textures.get(this._texKey).refresh();
            })
            .catch((e) => console.warn('[penguin] render', e))
            .finally(() => {
                this._rendering = false;
                if (this._needsRender) { this._needsRender = false; this._render(); }
            });
    }

    // ---------- Movimento ----------

    moveTo(targetX, targetY, speed = 150, onDone = null) {
        if (this.moveTween) this.moveTween.stop();
        this.moveTarget = { x: targetX, y: targetY };
        this._moveDone = onDone;

        const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
        if (distance < 4) {
            this.isMoving = false;
            this.setAction(this.direction);
            return;
        }

        this.isMoving = true;
        this.setAction(this.direction + 8);

        this.moveTween = this.scene.tweens.add({
            targets: this,
            x: targetX,
            y: targetY,
            duration: (distance / speed) * 1000,
            ease: 'Linear',
            onUpdate: () => {
                const dx = this.moveTarget.x - this.x;
                const dy = this.moveTarget.y - this.y;
                const d = Math.round((Math.atan2(dy, dx) * 180 / Math.PI - 90) / 45);
                const dir = ((d % 8) + 8) % 8 + 1;
                if (dir !== this.direction) {
                    this.direction = dir;
                    this.setAction(dir + 8);
                }
                this.updateDepth();
            },
            onComplete: () => {
                this.isMoving = false;
                this.moveTarget = null;
                this.moveTween = null;
                this.setAction(this.direction);
                this.updateDepth();
                const cb = this._moveDone;
                this._moveDone = null;
                if (cb) cb();
            }
        });
    }

    // depth = actor_depth do main.c: 901 + index + 1000*floor(y)
    // intercala com os segmentos ROOT do cenario SWL (mesma escala de depth)
    updateDepth() {
        this.setDepth(901 + this.depthSerial * 0.01 + 1000 * Math.floor(this.y));
    }

    // ---------- Roupa (paperdoll) ----------
    // gpaOutfit: { feet, body, neck, hand, face, head } -> itemId inteiro ou null

    equip(slot, itemId) {
        // flag/photo = slots do player card (pin/fundo) — nao desenham no
        // paperdoll, mas ficam em gpaOutfit para o PlayerCard
        const slots = ['feet', 'body', 'neck', 'hand', 'face', 'head', 'flag', 'photo'];
        if (!slots.includes(slot)) return;
        this.gpaOutfit = this.gpaOutfit || {};
        this.gpaOutfit[slot] = Number.isInteger(itemId) ? itemId : null;
        if (this.view) { this.view.setLook(this.gpaOutfit, this._viewScale()); this._render(); }
    }

    applyOutfit(raw) {
        this.gpaOutfit = {};
        if (raw) {
            for (const slot of ['feet', 'body', 'neck', 'hand', 'face', 'head', 'flag', 'photo']) {
                const v = raw[slot];
                this.gpaOutfit[slot] = Number.isInteger(v) ? v : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);
            }
        }
        if (this.view) { this.view.setLook(this.gpaOutfit, this._viewScale()); this._render(); }
    }

    // ---------- Chat ----------

    // Balão de fala fiel: arte vetorial do sprite 159 (interface pack) +
    // texto Phaser na fonte embarcada. Largura dinamica via stretch por fatias.
    showChat(message) {
        const scene = this.scene;
        this.chatBubble.removeAll(true);
        if (this._bubbleTexKey && scene.textures.exists(this._bubbleTexKey)) {
            scene.textures.remove(this._bubbleTexKey);
            this._bubbleTexKey = null;
        }

        bubbleArt(scene).then((art) => {
            if (!art || this.destroyed || !this.chatBubble || this.chatBubble.destroyed) return;

            // --- layoutBalloon() do original ---
            const lines = bubbleLines(message);
            const c = document.createElement('canvas').getContext('2d');
            c.font = '12px "BurbankSmallMedium", GoPenguin, Arial, sans-serif';
            const maxLineW = Math.max(...lines.map((l) => c.measureText(l).width), 0);
            const r = Math.min(114, maxLineW + 4);
            const d = r + 14;                    // largura do balão
            const f = lines.length * 13.8 + 11;  // altura do corpo
            const W = -48.25 - f;                // topo do corpo (coords do sprite)
            const TIP = -28.25;                  // base do rabinho

            const R = art.R;
            const outW = Math.ceil(d * R);
            const outH = Math.ceil((f + 20) * R);
            const cv = document.createElement('canvas');
            cv.width = outW; cv.height = outH;
            const cx = cv.getContext('2d');

            // canvas cobre wx ∈ [-d/2, d/2], wy ∈ [W, TIP]
            const toDev = (wx, wy) => [(wx + d / 2) * R, (wy - W) * R];

            // corpo (sprite114): escala (d/bw, f/bh), base em y=-48.25
            {
                const b = art.body.bounds, kx = d / (b[2] - b[0]), ky = f / (b[3] - b[1]);
                const [dx, dy] = toDev(b[0] * kx, b[1] * ky + (-48.25 - f) - b[1] * ky);
                cx.setTransform(1, 0, 0, 1, 0, 0);
                cx.drawImage(art.body.canvas, 0, 0, art.body.canvas.width, art.body.canvas.height,
                    dx, dy, (b[2] - b[0]) * kx * R, (b[3] - b[1]) * ky * R);
            }
            // rabinho (sprite156): escalaX=d/vw, y-scale 0.99, base em y=-48.25
            {
                const v = art.ptr.bounds, kx = d / (v[2] - v[0]), ky = 0.99;
                const [dx, dy] = toDev(v[0] * kx, v[1] * ky - 48.25);
                cx.drawImage(art.ptr.canvas, 0, 0, art.ptr.canvas.width, art.ptr.canvas.height,
                    dx, dy, (v[2] - v[0]) * kx * R, (v[3] - v[1]) * ky * R);
            }
            // texto — port exato do drawText() do GoPenguin:
            //   baseline local = bounds[1] + Ss(2) + size*0.9 + i*lineHeight(13.8)
            //   message_txt matrix ty = (w - f) + Ia(8) - I(-2) = -f - 38.25
            //   => baseline wy = i*13.8 - f - 27.45   (centrado em x=0)
            cx.save();
            cx.setTransform(1, 0, 0, 1, 0, 0);
            cx.beginPath();
            cx.rect(0, 0, outW, f * R);
            cx.clip();
            cx.setTransform(R, 0, 0, R, d / 2 * R, -W * R);
            cx.font = '12px "BurbankSmallMedium", GoPenguin, Arial, sans-serif';
            cx.fillStyle = '#000000';
            cx.textAlign = 'center';
            cx.textBaseline = 'alphabetic';
            lines.forEach((ln, i) => {
                cx.fillText(ln, 0, i * 13.8 - f - 27.45);
            });
            cx.restore();

            const texKey = `bubble_${this.playerId}_${Date.now()}`;
            scene.textures.addCanvas(texKey, cv);
            this._bubbleTexKey = texKey;

            // imagem: canvas cobre wy∈[W,TIP]; ponta do rabinho ~na cabeca (y≈-52)
            const img = scene.add.image(0, -(52 + f + 20), texKey)
                .setOrigin(0.5, 0).setDisplaySize(d, f + 20);
            this.chatBubble.add([img]);
            this.chatBubble.setPosition(0, 0).setVisible(true);

            if (this.chatTimer) this.chatTimer.remove();
            this.chatTimer = scene.time.delayedCall(5000, () => {
                this.chatBubble.setVisible(false);
            });
        });
    }

    destroy(fromScene) {
        if (this.animTimer) this.animTimer.remove();
        if (this.chatTimer) this.chatTimer.remove();
        if (this.moveTween) this.moveTween.stop();
        if (this._texKey && this.scene.textures.exists(this._texKey)) this.scene.textures.remove(this._texKey);
        if (this._bubbleTexKey && this.scene.textures.exists(this._bubbleTexKey)) this.scene.textures.remove(this._bubbleTexKey);
        super.destroy(fromScene);
    }
}
