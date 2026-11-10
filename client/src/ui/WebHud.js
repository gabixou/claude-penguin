// HUD web classico do Club Penguin (gopenguin.lol): barra de acoes inferior
// largura total com pill de chat escuro integrado no centro.
// Layout em coords de jogo 760x480.
import Phaser from 'phaser';

// pill de chat integrado no centro da barra de acoes (como no gopenguin.lol)
const CHAT_X = 250, CHAT_Y = 431, CHAT_W = 260, CHAT_H = 38;
const BAR_X = 16, BAR_Y = 420, BAR_W = 728, BAR_H = 56;

// centros dos botoes (x,y) — grupos esquerda/direita dentro da barra de acoes
const LEFT_BTNS = [64, 112, 160, 208];
const RIGHT_BTNS = [540, 588, 636, 684, 732];
const BTN_Y = 450, BTN_SIZE = 36;

export default class WebHud extends Phaser.GameObjects.Container {
    constructor(scene) {
        super(scene, 0, 0);
        this._cbs = {};
        this.blockY = BAR_Y - 4; // cliques abaixo disso nao movem o pinguim
        this._build(scene);
        scene.add.existing(this);
    }

    _build(scene) {
        const g = scene.add.graphics();
        this.add(g);

        // ---- barra de acoes: pill/capsula flutuante, gradiente azul ----
        const lerp = (a, b, t) => {
            const r = Math.round((a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * t);
            const g = Math.round((a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t);
            const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
            return (r << 16) | (g << 8) | bl;
        };
        const r = 18;
        const TOP = 0x3d9ade, BOTTOM = 0x123f63;
        // moldura externa (azul claro) + corpo com gradiente vertical
        g.fillStyle(0x8ecdf2, 1);
        g.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, r);
        const steps = 8, innerH = BAR_H - 8;
        // corpo base escuro (fecha as pontas arredondadas inferiores)
        g.fillStyle(BOTTOM, 1);
        g.fillRoundedRect(BAR_X + 4, BAR_Y + 4, BAR_W - 8, innerH, r - 4);
        for (let i = 0; i < steps - 1; i++) {
            g.fillStyle(lerp(TOP, BOTTOM, (i + 0.5) / steps), 1);
            const sy = BAR_Y + 4 + innerH * i / steps;
            const sh = innerH / steps + 1;
            if (i === 0) g.fillRoundedRect(BAR_X + 4, sy, BAR_W - 8, sh + (r - 4), { tl: r - 4, tr: r - 4, bl: 0, br: 0 });
            else g.fillRect(BAR_X + 4, sy, BAR_W - 8, sh);
        }
        // faixa de luz no topo do corpo
        g.fillStyle(0x00d5ff, 0.9);
        g.fillRect(BAR_X + 8, BAR_Y + 4, BAR_W - 16, 2);
        g.fillStyle(0x9fdcff, 0.8);
        g.fillRect(BAR_X + 8, BAR_Y + 7, BAR_W - 16, 1);
        // contorno branco caracteristico do estilo Flash
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRoundedRect(BAR_X + 1, BAR_Y + 1, BAR_W - 2, BAR_H - 2, r - 1);

        // ---- pill de chat: campo escuro integrado no centro da barra azul ----
        g.fillStyle(0x002b5c, 1);
        g.fillRoundedRect(CHAT_X, CHAT_Y, CHAT_W, CHAT_H, 10);
        g.lineStyle(2, 0x00c3ff, 0.9);
        g.strokeRoundedRect(CHAT_X, CHAT_Y, CHAT_W, CHAT_H, 10);
        g.lineStyle(1, 0xffffff, 0.7);
        g.strokeRoundedRect(CHAT_X + 1, CHAT_Y + 1, CHAT_W - 2, CHAT_H - 2, 9);

        // ---- botoes circulares com icones reais recortados (9, como na ref) ----
        // esquerda: chat, emoticon, actions, snowball | direita: quickchat, star, smiley, igloo, help
        const leftIds = ['chat', 'emoticon', 'actions', 'snowball'];
        const rightIds = ['quickchat', 'star', 'smiley', 'igloo', 'help'];
        let n = 0;
        for (const [i, id] of leftIds.entries()) this._btn(scene, `hud_btn_${n + 2}`, LEFT_BTNS[i], BTN_Y, id), n++;
        for (const [i, id] of rightIds.entries()) this._btn(scene, `hud_btn_${n + 2}`, RIGHT_BTNS[i], BTN_Y, id), n++;

        // ---- botao de chat redondo dentro da barra de chat (extremidade direita) ----
        const chatBtn = scene.add.image(CHAT_X + CHAT_W - 15, CHAT_Y + CHAT_H / 2, 'hud_btn_2').setDisplaySize(20, 20).setInteractive({ useHandCursor: true });
        this.add(chatBtn);
        chatBtn.on('pointerdown', () => this._fire('chat'));

        // ---- icone MAP dobrado (a esquerda da barra, sobrepondo a ponta da HUD) ----
        const map = scene.add.image(36, 392, 'hud_map').setDisplaySize(60, 60).setInteractive({ useHandCursor: true });
        this.add(map);
        map.on('pointerdown', () => this._fire('map'));

        // ---- envelope correio (topo esquerdo): sprite solto, sem caixa ----
        const mail = scene.add.image(36, 30, 'hud_mail').setDisplaySize(72, 57).setInteractive({ useHandCursor: true });
        this.add(mail);
        mail.on('pointerdown', () => this._fire('mail'));
    }

    _btn(scene, key, x, y, id) {
        const img = scene.add.image(x, y, key).setDisplaySize(BTN_SIZE, BTN_SIZE).setInteractive({ useHandCursor: true });
        this.add(img);
        img.on('pointerdown', () => this._fire(id));
        // zona de bloqueio invisivel um pouco maior que o botao
        const zone = scene.add.zone(x, y, BTN_SIZE + 8, BTN_SIZE + 8).setInteractive({ useHandCursor: true });
        this.add(zone);
        zone.on('pointerdown', () => this._fire(id));
    }

    _fire(id) { if (this._cbs.button) this._cbs.button(id); }
    onButton(cb) { this._cbs.button = cb; }

    // rect do pill de chat em coords de jogo (para posicionar input DOM)
    chatPillRect() { return { x: CHAT_X, y: CHAT_Y, w: CHAT_W, h: CHAT_H }; }
}
