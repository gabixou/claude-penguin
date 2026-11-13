// Interacoes de cenario das salas — port simplificado do RoomDirector (Ti) e
// dos room scripts do gopenguin.lol. Cobre: botoes com hit-test (records
// hittest), estados up/over/down, walk-to-door no clique e hover actions
// (ex.: toldo da Dance Club acendendo, porta da Gift Shop).

import { playRoomSfx } from '../audio/Sfx.js';
import { UiTooltip } from '../ui/Tooltip.js';
import HINTS from '../ui/hints.js';

// Scripts extraidos do bundle do gopenguin (room actions). Chaves casam por
// sufixo com o path do botao (ex.: 'background_mc.coffee_btn').
const ROOM_SCRIPTS = {
    town: {
        buttons: {
            coffee_btn: { walk: [275, 225] },
            dance_btn: {
                walk: [342, 205],
                hover: [{ path: 'dance_canopy_mc', over: 2, out: 1 }],
            },
            shop_btn: { walk: [505, 233] },
        },
    },
    // Oh() do bundle gopenguin — Dance Club. update() (iluminacao por
    // jogadores/cores) ainda nao portado.
    dance: {
        start: [180, 280],
        buttons: {
            'background_mc.town_btn': { walk: [110, 270] },
            'background_mc.lounge_btn': { walk: [680, 355] },
            'secretspeaker_mc.boiler_btn': { walk: [480, 210] },
            'djtable_mc.dj_mc.dj_btn': {
                walk: [260, 150],
                hover: [
                    { path: 'djtable_mc.dj_mc', over: 2, out: 1 },
                    { path: 'djtable_mc.djled_mc', over: 2, out: 1 },
                ],
            },
            'djtable_mc.dj_mc.mixer_btn': { walk: [330, 160] },
            'dancetable_mc.table_btn': {
                walk: [525, 270],
                hover: [
                    { path: 'dancetable_mc', over: 2, out: 1, playOver: true },
                    { path: 'background_mc.danceposter_mc.danceposterlang_mc', over: 2, out: 1 },
                    { path: 'background_mc.dancepostertrim_mc', over: 2, out: 1 },
                ],
            },
        },
    },
};

// Mesas de jogo — port do setupTable() dos packs SWF (lodge/attic/book):
// o game_btn anda ate a mesa (a trigger sendJoinTable resolve a partida) e
// o hover mostra a hint original + troca o game_mc para o frame 'over' (2).
// Os waddles (dojo/mtn) ja trazem onRelease/onRollOver inline no AS — o
// parse do movie.js cobre walk + hint automaticamente.
const TABLE_GAME = {
    lodge: ['four', [205, 206, 207]],
    attic: ['four', [200, 201, 202, 203, 204]],
    book: ['mancala', [100, 101, 102, 103, 104]],
};
const TABLE_HINT = { four: 'four_hint', mancala: 'mancala_hint' };
for (const [room, [game, ids]] of Object.entries(TABLE_GAME)) {
    const buttons = {};
    for (const id of ids) {
        buttons[`table${id}_mc.game_btn`] = {
            hint: TABLE_HINT[game],
            triggerName: `table${id}_mc`,
            hover: [{ path: `table${id}_mc.game_mc`, over: 2, out: 1 }],
        };
    }
    ROOM_SCRIPTS[room] = { buttons: { ...(ROOM_SCRIPTS[room]?.buttons || {}), ...buttons } };
}

export class RoomInteractions {
    constructor(scene, movie, roomKey) {
        this.scene = scene;
        this.movie = movie;
        this.roomKey = roomKey;
        this.buttons = [];
        this.hovered = null;
        this._hintText = null;
        this._tooltip = null;
        this._hintLayer = null;
    }

    destroy() {
        this._tooltip?.hide();
        this._hintLayer?.destroy();
        this._hintLayer = null;
        this._tooltip = null;
    }

    build() {
        if (!this.movie) return;
        const script = ROOM_SCRIPTS[this.roomKey] || {};
        const defs = script.buttons || {};
        this.buttons = this.movie.findButtons()
            .map((b) => {
            const key = Object.keys(defs).find(
                (k) => b.path === k || b.path.endsWith('.' + k) || b.name === k
            );
            const def = key ? defs[key] : {};
            // AS parseado do SWF (onRelease) — fonte autoritativa
            const parsed = this.movie._matchPath(this.movie.interactions.click, b.path, b.name);
            const parsedDis = this.movie.interactions.disabled.has(b.path)
                || [...this.movie.interactions.disabled].some((d) => b.path.endsWith('.' + d) || d.endsWith('.' + b.path));
            return {
                ...b,
                walk: def.walk || parsed?.walk || this._defaultWalk(b),
                triggerName: def.triggerName || null,
                hover: def.hover || [],
                sfxHover: def.sfxHover,
                sfxClick: def.sfxClick,
                content: def.content || parsed?.content,
                game: def.game || parsed?.game,
                hint: (() => {
                    const key = def.hint || this.movie._matchPath(this.movie.interactions.hint || {}, b.path, b.name);
                    return key ? HINTS[key] : null;
                })(),
                disabled: parsedDis || !!def.disabled
                    // interface_mc so interage se o AS der acao real
                    // (catalogo/jogo); sem acao, botao de HUD nao anda o pinguim
                    || (b.path.startsWith('interface_mc') && !parsed?.content && !parsed?.game && !parsed?.walk),
            };
        }).filter((b) => !b.disabled);
        this.hovered = null;
    }

    // Sem script: anda ate o centro do botao (a trigger da porta resolve a troca).
    _defaultWalk(b) {
        const [x0, y0, x1, y1] = b.bounds;
        return [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)];
    }

    // Botao no topo da pilha (desenhado por ultimo = maior prioridade).
    buttonAt(x, y) {
        for (let i = this.buttons.length - 1; i >= 0; i--) {
            const b = this.buttons[i];
            const [x0, y0, x1, y1] = b.bounds;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return b;
        }
        return null;
    }

    // Chamado a cada pointermove — aplica states up/over e hover actions.
    hoverAt(x, y) {
        if (!this.movie || !this.buttons.length) return;
        const b = this.buttonAt(x, y);
        const path = b ? b.path : null;
        if (path === this.hovered) return;
        if (this.hovered) {
            const old = this.buttons.find((o) => o.path === this.hovered);
            this.movie.setButtonState(this.hovered, 'up');
            for (const a of old?.hover || []) this.movie.gotoPath(a.path, a.out, false);
        }
        if (b) {
            this.movie.setButtonState(b.path, 'over');
            // hover actions seguram o frame 'over' (gotoAndStop) — como no
            // gp, o estado fica ate o hover-out. playOver toca a animacao.
            for (const a of b.hover) this.movie.gotoPath(a.path, a.over, !!a.playOver);
            if (b.sfxHover !== undefined) playRoomSfx(this.roomKey, b.sfxHover);
        }
        this.hovered = path;
        // hint original (INTERFACE.showHint) — caixa hint_mc acima do botao
        if ((b?.hint || null) !== this._hintText) {
            this._hintText = b?.hint || null;
            if (this._hintText) this._showHint(b);
            else this._tooltip?.hide();
        }
    }

    _ensureHint() {
        if (this._tooltip || !this.scene.add) return;
        this._hintLayer = this.scene.add.container(0, 0).setDepth(16000000);
        this._tooltip = new UiTooltip(this.scene, this._hintLayer);
    }

    _showHint(b) {
        this._ensureHint();
        const [x0, y0, x1, y1] = b.bounds;
        this._tooltip.show(x0, y0, x1 - x0, y1 - y0, this._hintText);
    }

    // Clique no botao: retorna {walk} ou {content}/{game} do onRelease.
    clickTarget(x, y) {
        const b = this.buttonAt(x, y);
        if (b?.sfxClick !== undefined) playRoomSfx(this.roomKey, b.sfxClick);
        if (!b) return null;
        if (b.content) return { content: b.content };
        if (b.game) return { game: b.game };
        // centroide da zona de trigger — resolvido no clique porque o
        // buildCollision pode nao ter terminado quando build() rodou
        const tw = b.triggerName && this.movie.triggerCenter?.(b.triggerName);
        const [tx, ty] = tw || b.walk;
        return { x: tx, y: ty };
    }
}
