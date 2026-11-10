// VectorHud.js — HUD vetorial do Club Penguin (dock_mc + icons_mc do
// pacote /assets/movies/interface). Substitui o WebHud bitmap:
// renderiza os sprites reais do SWF num canvas 760x480 e converte os
// botoes nomeados em zonas clicaveis mapeadas para as acoes do jogo.
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { WORLD_W, WORLD_H } from '../display.js';

const RENDER_SCALE = 2;
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// icones condicionais do interface.swf: no gopenguin.lol so o correio e o
// mapa aparecem por padrao (news/mod/egg/buddy/phone dependem de estado
// que o backend ainda nao tem) — escondidos para ficar fiel a ref.
const HIDE_BY_SPRITE = {
    '228': ['buddy_online_mc'], // barra "buddy online" amarela — sem sistema de buddies
    '334': ['phone_mc', 'hudIconView', 'mod_mc', 'egg_timer_mc', 'news_mc', 'buddy_btn', 'mail_mc'], // mail_mc: sem sistema de correio ainda
};

// botao do dock_mc/icons_mc -> acao (mesmos ids do handleHudButton)
const BUTTON_ACTIONS = {
    // dock inferior (sprite 228)
    safe_btn: 'safe', emote_btn: 'emoticon', action_btn: 'actions',
    throw_btn: 'snowball', chat_mc: 'chat', player_btn: 'playercard',
    player_icon_mc: 'playercard', buddy_btn: 'buddy', home_btn: 'igloo',
    help_btn: 'help',
    // icones (sprite 334)
    map_mc: 'map', mail_mc: 'mail', news_mc: 'news',
    phone_mc: 'phone', hudIconView: 'hud', mod_mc: 'mod',
    egg_timer_mc: 'eggtimer', buddy_online_mc: 'buddy',
};

export default class VectorHud extends Phaser.GameObjects.Container {
    constructor(scene) {
        super(scene, 0, 0);
        this._cbs = {};
        this.blockY = 416; // cliques abaixo disso nao movem o pinguim
        this._chatRect = { x: 498, y: 443, w: 76, h: 30 };
        scene.add.existing(this);
        this._build(scene);
    }

    _movie() {
        if (!this.scene.game._interfaceMoviePromise) {
            this.scene.game._interfaceMoviePromise = MovieRoom.load('/assets/movies/interface')
                .then((m) => { m.setScale(1); return m; })
                .catch((e) => { console.warn('[vectorhud] interface load', e); return null; });
        }
        return this.scene.game._interfaceMoviePromise;
    }

    async _build(scene) {
        const movie = await this._movie();
        if (!movie || !scene.sys.isActive()) return;
        const clip = new Clip(movie);

        // canvas full-stage transparente: dock + icons nas coords originais
        const canvas = document.createElement('canvas');
        canvas.width = WORLD_W * RENDER_SCALE;
        canvas.height = WORLD_H * RENDER_SCALE;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

        const frames = [];
        for (const sid of ['228', '334']) {
            const sp = movie.sprites[sid];
            const hide = new Set(HIDE_BY_SPRITE[sid] || []);
            if (sp?.frames?.[0]) {
                frames.push({ sid, hide, entries: sp.frames[0].filter((e) => !hide.has(e.name)) });
            }
        }
        for (const { entries } of frames) {
            await clip._drawListFrame(ctx, entries, IDENT, '', IDENT_COLOR, RENDER_SCALE);
        }

        const texKey = `vectorhud_${Date.now()}`;
        scene.textures.addCanvas(texKey, canvas);
        const img = scene.add.image(0, 0, texKey).setOrigin(0, 0).setDisplaySize(WORLD_W, WORLD_H);
        this.add(img);

        // zonas dos botoes (coords de stage = coords de mundo)
        for (const { entries } of frames) {
            for (const e of entries) {
                const action = BUTTON_ACTIONS[e.name];
                if (!action) continue;
                const eb = clip._boundsOf([e], IDENT, '');
                if (!eb) continue;
                const cx = (eb[0] + eb[2]) / 2, cy = (eb[1] + eb[3]) / 2;
                const w = Math.max(eb[2] - eb[0], 20), h = Math.max(eb[3] - eb[1], 20);
                const zone = scene.add.zone(cx, cy, w, h)
                    .setInteractive({ useHandCursor: true });
                zone.on('pointerdown', () => this._fire(action));
                this.add(zone);
                if (e.name === 'chat_mc') {
                    // cilindro de chat inteiro como area de texto —
                    // margens internas pequenas, reserva ~48px a direita p/ send_btn
                    this._chatRect = {
                        x: eb[0] + 8, y: eb[1] + 4,
                        w: eb[2] - eb[0] - 56, h: eb[3] - eb[1] - 8
                    };
                }
            }
        }
        // o input DOM de chat depende deste rect — avisa para relayout
        scene.events.emit('vectorhud:ready');
    }

    _fire(id) { if (this._cbs.button) this._cbs.button(id); }
    onButton(cb) { this._cbs.button = cb; }

    // rect do campo de chat em coords de jogo (para posicionar input DOM)
    chatPillRect() { return this._chatRect; }
}
