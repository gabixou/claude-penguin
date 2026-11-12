// TableGames.js — interface dos jogos de mesa (Find Four, Mancala, Treasure
// Hunt, Card-Jitsu). Overlay DOM sobre a sala; TODA a regra roda no
// servidor (server/src/tables.js): aqui so desenhamos o TABLE_STATE e
// mandamos a jogada escolhida. Abre pelas mesas das salas (Book Room,
// Lodge, Attic, Dojo) ou pelo painel "Sistemas" > Jogos.

import FindFourView, { FIND_FOUR_CSS } from './FindFourView.js';

const TITLES = { four: 'Find Four', mancala: 'Mancala', treasure: 'Treasure Hunt', card: 'Card-Jitsu' };
const ELEMENT_ICON = { fire: '🔥', water: '💧', snow: '❄️' };
const COLOR_HEX = { red: '#e53935', blue: '#1e88e5', green: '#43a047', yellow: '#fdd835', orange: '#fb8c00', purple: '#8e24aa' };

const CSS = `
.cp-tg{position:fixed;inset:0;z-index:95000;display:flex;align-items:center;justify-content:center;background:rgba(6,18,40,.55);font-family:Arial,Helvetica,sans-serif;user-select:none}
.cp-tg .win{width:min(560px,94vw);background:linear-gradient(#1b5fb0,#123f7d);border:3px solid #9cc8f5;border-radius:18px;box-shadow:0 14px 44px rgba(0,0,0,.5);color:#fff;overflow:hidden}
.cp-tg .top{display:flex;align-items:center;gap:8px;padding:10px 14px 6px}
.cp-tg .top h2{margin:0;font-size:19px;flex:1;letter-spacing:.3px;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.cp-tg .x{width:30px;height:30px;border-radius:50%;border:2px solid #fff;background:#0d3a73;color:#fff;font-weight:900;cursor:pointer}
.cp-tg .players{display:flex;gap:8px;padding:0 14px}
.cp-tg .pl{flex:1;display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.1);border-radius:10px;padding:6px 9px;font-size:13px;font-weight:700;border:2px solid transparent;min-width:0}
.cp-tg .pl.turn{border-color:#ffd54a;background:rgba(255,213,74,.16)}
.cp-tg .pl .dot{width:14px;height:14px;border-radius:50%;flex:none;box-shadow:inset 0 -2px 0 rgba(0,0,0,.25)}
.cp-tg .pl .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-tg .pl .sc{margin-left:auto;font-size:12px;opacity:.9}
.cp-tg .status{text-align:center;font-size:14px;font-weight:700;padding:8px 14px 4px;min-height:20px}
.cp-tg .timer{height:5px;margin:0 14px 8px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden}
.cp-tg .timer i{display:block;height:100%;background:#ffd54a;transition:width .25s linear}
.cp-tg .stage{padding:6px 14px 14px;display:flex;justify-content:center}
.cp-tg .foot{display:flex;gap:8px;justify-content:center;padding:0 14px 14px;flex-wrap:wrap}
.cp-tg .btn{padding:8px 16px;border-radius:20px;border:2px solid #fff;background:#ffcc33;color:#123f7d;font-weight:900;font-size:13px;cursor:pointer}
.cp-tg .btn.alt{background:transparent;color:#fff}
.cp-tg .err{color:#ffb3b3;font-size:12px;text-align:center;min-height:14px;padding:0 14px 6px}
/* Mancala */
.cp-tg .mc{display:grid;grid-template-columns:62px repeat(6,52px) 62px;grid-template-rows:62px 62px;gap:12px 6px;padding:12px 12px 16px;background:linear-gradient(#a8662d,#7c4519);border-radius:40px;box-shadow:inset 0 -5px 0 rgba(0,0,0,.25)}
.cp-tg .mc .pit,.cp-tg .mc .store{background:#5a2f0e;border-radius:50%;box-shadow:inset 0 4px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;position:relative;font-weight:900;font-size:15px}
.cp-tg .mc .store{grid-row:1 / span 2;border-radius:30px}
.cp-tg .mc .pit.can{cursor:pointer;box-shadow:inset 0 4px 8px rgba(0,0,0,.5),0 0 0 3px #ffd54a}
.cp-tg .mc .pit.can:hover{background:#6e3b14}
.cp-tg .mc .n{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);z-index:1;min-width:20px;padding:1px 5px;border-radius:9px;background:#f4e3c4;color:#5a2f0e;font-size:12px;text-align:center;box-shadow:0 1px 0 rgba(0,0,0,.35)}
.cp-tg .mc .st{position:absolute;inset:9px 8px 12px;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:2px}
.cp-tg .mc .st b{width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9f1ff,#3b8fd6)}
.cp-tg .mc .hl{animation:cp-pulse .6s ease-out}
@keyframes cp-pulse{from{box-shadow:inset 0 4px 8px rgba(0,0,0,.5),0 0 0 6px rgba(255,255,255,.8)}}
/* Treasure Hunt */
.cp-tg .th{display:grid;grid-template-columns:26px repeat(10,30px);grid-auto-rows:30px;gap:2px}
.cp-tg .th .hd{display:flex;align-items:center;justify-content:center;border-radius:6px;background:#0d3a73;font-size:11px;font-weight:900}
.cp-tg .th .hd.can{cursor:pointer;background:#ffcc33;color:#123f7d}
.cp-tg .th .hd.dug{opacity:.35}
.cp-tg .th .cell{border-radius:4px;background:#e9c66f;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.15)}
.cp-tg .th .cell.half{background:#d1a64a}
.cp-tg .th .cell.open{background:#8a6324}
.cp-tg .th .cell.new{animation:cp-pulse .6s ease-out}
.cp-tg .th .coin{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3b0,#f4c21b 55%,#b8860b);box-shadow:inset 0 0 0 2px #c99a10,0 1px 0 rgba(0,0,0,.35)}
/* Card-Jitsu */
.cp-tg .cj{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%}
.cp-tg .cj .row{display:flex;gap:6px;justify-content:center;min-height:30px;flex-wrap:wrap}
.cp-tg .cj .card{width:62px;height:84px;border-radius:9px;background:#fff;color:#123f7d;border:5px solid #999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;box-shadow:0 3px 0 rgba(0,0,0,.3);position:relative}
.cp-tg .cj .card .el{font-size:26px;line-height:1}
.cp-tg .cj .card .v{font-size:18px}
.cp-tg .cj .card.back{background:repeating-linear-gradient(45deg,#2b6fc2 0 6px,#1e5aa6 6px 12px);border-color:#fff}
.cp-tg .cj .card.pick{cursor:pointer;transition:transform .12s}
.cp-tg .cj .card.pick:hover{transform:translateY(-8px)}
.cp-tg .cj .card.sel{transform:translateY(-12px);outline:3px solid #ffd54a}
.cp-tg .cj .mini{width:30px;height:38px;border-radius:5px;border-width:3px;font-size:13px}
.cp-tg .cj .mini .el{font-size:14px}.cp-tg .cj .mini .v{display:none}
.cp-tg .cj .mini.win{outline:2px solid #ffd54a}
.cp-tg .cj .battle{display:flex;gap:18px;align-items:center;min-height:92px}
.cp-tg .cj .vs{font-weight:900;font-size:18px;opacity:.8}
.cp-tg .cj .lbl{font-size:11px;opacity:.85;text-align:center}
.cp-tg .cj .card.lost{opacity:.45}
`;

let styled = false;
const ensureStyle = () => {
    if (styled || typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.id = 'cp-tablegames-style';
    s.textContent = CSS + FIND_FOUR_CSS;
    document.head.appendChild(s);
    styled = true;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default class TableGames {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this.st = null;
        this.req = null;
        this._onState = (d) => this._state(d);
        this._onError = (d) => this._error(d?.error);
    }

    get isOpen() { return !!this.el; }

    // req: { game, room?, tableId?, cpu? }
    open(req) {
        ensureStyle();
        if (!this.scene.network?.isConnected) return false;
        this.close(false);
        this.req = req;
        this.st = null;
        this._build();
        this.scene.events.on('packet-TABLE_STATE', this._onState);
        this.scene.events.on('packet-TABLE_ERROR', this._onError);
        this.scene.network.send('TABLE_JOIN', req);
        this._status('Sentando à mesa...');
        return true;
    }

    close(leave = true) {
        if (!this.el) return;
        if (leave && this.st?.key) this.scene.network?.send('TABLE_LEAVE', { key: this.st.key });
        this.scene.events.off('packet-TABLE_STATE', this._onState);
        this.scene.events.off('packet-TABLE_ERROR', this._onError);
        clearInterval(this._tick);
        this.el.remove();
        this.el = null;
        this.st = null;
        this._ff = null;
        this.scene._tableClosedAt = this.scene.time?.now;
    }

    // ---------------------------------------------------------------- UI
    _build() {
        const el = document.createElement('div');
        // Find Four tem tela propria (kit vetorial + sons/fontes do SWF)
        el.className = this.req.game === 'four' ? 'cp-tg four' : 'cp-tg';
        el.innerHTML = `<div class="win">
            <div class="top"><h2>${esc(TITLES[this.req.game] || this.req.game)}</h2><button class="x" title="Sair">✕</button></div>
            <div class="players"></div>
            <div class="status"></div>
            <div class="timer"><i style="width:0"></i></div>
            <div class="stage"></div>
            <div class="err"></div>
            <div class="foot"></div>
        </div>`;
        el.querySelector('.x').onclick = () => this.close();
        // clique no fundo escuro nao vaza para a sala
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        document.body.appendChild(el);
        this.el = el;
        this.$ = (s) => el.querySelector(s);
        this._tick = setInterval(() => this._renderTimer(), 250);
    }

    _status(t) { if (this.el) this.$('.status').textContent = t; }
    _error(msg) {
        if (!this.el) return;
        const e = this.$('.err');
        e.textContent = msg || '';
        clearTimeout(this._errT);
        this._errT = setTimeout(() => { if (this.el) e.textContent = ''; }, 2500);
        if (!this.st) this._foot([['Fechar', () => this.close(false), true]]);
    }

    _foot(btns) {
        const f = this.$('.foot');
        f.innerHTML = '';
        for (const [label, fn, alt] of btns) {
            const b = document.createElement('button');
            b.className = alt ? 'btn alt' : 'btn';
            b.textContent = label;
            b.onclick = fn;
            f.appendChild(b);
        }
    }

    _send(move) {
        if (!this.st || this.st.status !== 'playing') return;
        this.scene.network.send('TABLE_MOVE', { key: this.st.key, move });
    }

    _state(d) {
        if (!this.el || !d) return;
        if (this.st && d.key !== this.st.key) return; // outra mesa
        this.prev = this.st;
        this.st = d;
        this.stamp = Date.now();
        this._renderPlayers();
        this._renderStatus();
        this._renderBoard();
        this._renderFoot();
    }

    _myTurn() {
        const s = this.st;
        if (!s || s.status !== 'playing') return false;
        if (s.game === 'card') return s.state.seats[s.you].picked === null;
        return s.turn === s.you;
    }

    _seatColor(i) {
        const g = this.st?.game;
        if (g === 'four') return i === 0 ? '#e53935' : '#1e88e5';
        if (g === 'card') return i === 0 ? '#ff7043' : '#29b6f6';
        if (g === 'treasure') return i === 0 ? '#ffd54a' : '#9ccc65';
        return i === 0 ? '#8d5524' : '#3b8fd6';
    }

    _score(i) {
        const s = this.st?.state;
        if (!s) return '';
        if (this.st.game === 'mancala') return `${s.pits[i === 0 ? 6 : 13]} pedras`;
        if (this.st.game === 'card') return `${s.seats[i].bank.length} cartas`;
        if (this.st.game === 'treasure') return i === 0 ? `${s.score} moedas` : '';
        return '';
    }

    _renderPlayers() {
        const s = this.st;
        if (!s) return;
        const order = [s.you, 1 - s.you]; // voce primeiro
        this.$('.players').innerHTML = order.map((i) => {
            const p = s.seats[i];
            const turn = s.status === 'playing' && (s.game === 'card'
                ? s.state.seats[i].picked === null || s.state.seats[i].picked === false
                : s.turn === i);
            const name = p ? (i === s.you ? `${p.username} (você)` : p.username) : 'Aguardando...';
            return `<div class="pl${turn ? ' turn' : ''}"><span class="dot" style="background:${this._seatColor(i)}"></span>
                <span class="nm">${esc(name)}</span><span class="sc">${esc(this._score(i))}</span></div>`;
        }).join('');
    }

    _renderStatus() {
        const s = this.st;
        if (s.status === 'waiting') return this._status('Aguardando outro jogador sentar...');
        if (s.status === 'over') {
            const r = s.result || {};
            const coins = r.coins ? ` +${r.coins} moedas` : '';
            if (r.coop) return this._status(`Fim da caça! Vocês acharam ${r.score} em tesouros.${coins}`);
            if (r.forfeit !== null && r.forfeit !== undefined && r.forfeit !== s.you) return this._status(`O oponente saiu — você venceu!${coins}`);
            if (r.winner === null) return this._status(`Empate!${coins}`);
            return this._status(r.winner === s.you ? `Você venceu!${coins}` : `Você perdeu.${coins}`);
        }
        if (s.game === 'card') {
            const me = s.state.seats[s.you];
            return this._status(me.picked === null ? 'Escolha uma carta!' : 'Aguardando o oponente escolher...');
        }
        const other = s.seats[1 - s.you];
        if (s.turn === s.you) {
            const extra = s.game === 'mancala' && this.prev?.turn === s.you && this.prev?.status === 'playing' ? ' (jogada extra!)' : '';
            return this._status(`Sua vez${extra}`);
        }
        this._status(`Vez de ${other?.username || 'oponente'}`);
    }

    _renderTimer() {
        if (!this.el) return;
        const s = this.st;
        const bar = this.$('.timer i');
        if (!s || s.status !== 'playing' || !s.msLeft) { bar.style.width = '0'; return; }
        const total = s.game === 'card' ? 20000 : 30000;
        const left = Math.max(0, s.msLeft - (Date.now() - this.stamp));
        bar.style.width = `${(left / total) * 100}%`;
        bar.style.background = left < 6000 ? '#ff6b6b' : '#ffd54a';
    }

    _renderFoot() {
        const s = this.st;
        if (s.status === 'waiting') {
            this._foot([
                ['Jogar contra o computador', () => this.scene.network.send('TABLE_CPU', { key: s.key })],
                ['Sair', () => this.close(), true],
            ]);
        } else if (s.status === 'over') {
            const again = s.seats.some((p) => p?.cpu)
                ? { game: s.game, cpu: true }
                : (this.req.tableId !== undefined ? this.req : { game: s.game });
            this._foot([
                ['Jogar de novo', () => this.open(again)],
                ['Fechar', () => this.close(), true],
            ]);
        } else {
            this._foot([['Desistir', () => this.close(), true]]);
        }
    }

    _renderBoard() {
        const st = this.$('.stage');
        const s = this.st;
        // Find Four desenha a mesa mesmo esperando ("Waiting for Player")
        if (s.game === 'four') { this._four(st); return; }
        if (!s.state) { st.innerHTML = ''; return; }
        if (s.game === 'mancala') this._mancala(st);
        else if (s.game === 'treasure') this._treasure(st);
        else if (s.game === 'card') this._card(st);
    }

    // ---------------------------------------------------------------- Find Four
    _four(stage) {
        if (!this._ff || !stage.contains(this._ff.el)) {
            this._ff = new FindFourView(stage, {
                onMove: (col) => this._send({ col }),
                onClose: () => this.close(),
            });
        }
        this._ff.update(this.st);
    }

    // ---------------------------------------------------------------- Mancala
    _mancala(stage) {
        const s = this.st, p = s.state.pits;
        const me = s.you;
        const mine = this._myTurn();
        const ends = new Set();
        if (s.state.last) ends.add(s.state.last.end);
        // seu lado sempre embaixo, da esquerda para a direita
        const myPits = me === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
        const opPits = me === 0 ? [12, 11, 10, 9, 8, 7] : [5, 4, 3, 2, 1, 0];
        const myStore = me === 0 ? 6 : 13, opStore = me === 0 ? 13 : 6;
        const stones = (n) => `<div class="st">${'<b></b>'.repeat(Math.min(n, 14))}</div>`;
        const pit = (i, can, local) => `<div class="pit${can ? ' can' : ''}${ends.has(i) ? ' hl' : ''}"${can ? ` data-pit="${local}"` : ''}>${stones(p[i])}<span class="n">${p[i]}</span></div>`;
        let html = '<div class="mc">';
        html += `<div class="store${ends.has(opStore) ? ' hl' : ''}" style="grid-column:1">${stones(p[opStore])}<span class="n">${p[opStore]}</span></div>`;
        opPits.forEach((i) => { html += pit(i, false); });
        html += `<div class="store${ends.has(myStore) ? ' hl' : ''}" style="grid-column:8">${stones(p[myStore])}<span class="n">${p[myStore]}</span></div>`;
        myPits.forEach((i, k) => { html += pit(i, mine && p[i] > 0, k).replace('class="pit', `style="grid-row:2;grid-column:${k + 2}" class="pit`); });
        stage.innerHTML = html + '</div>';
        stage.querySelectorAll('[data-pit]').forEach((el) => {
            el.onclick = () => this._send({ pit: Number(el.dataset.pit) });
        });
    }

    // ---------------------------------------------------------------- Treasure Hunt
    _treasure(stage) {
        const s = this.st, t = s.state;
        const mine = this._myTurn();
        const found = new Map(t.found.map((f) => [f.cell, f]));
        const fresh = new Set(t.last?.found || []);
        let html = '<div class="th"><div></div>';
        for (let c = 0; c < 10; c++) {
            const dug = t.cols.includes(c);
            html += `<div class="hd${dug ? ' dug' : mine ? ' can' : ''}"${!dug && mine ? ` data-line="col" data-i="${c}"` : ''}>${dug ? '·' : '▼'}</div>`;
        }
        for (let r = 0; r < 10; r++) {
            const rdug = t.rows.includes(r);
            html += `<div class="hd${rdug ? ' dug' : mine ? ' can' : ''}"${!rdug && mine ? ` data-line="row" data-i="${r}"` : ''}>${rdug ? '·' : '▶'}</div>`;
            for (let c = 0; c < 10; c++) {
                const cell = r * 10 + c;
                const cdug = t.cols.includes(c);
                const open = rdug && cdug;
                const f = found.get(cell);
                const cls = open ? 'open' : rdug || cdug ? 'half' : '';
                html += `<div class="cell ${cls}${fresh.has(cell) ? ' new' : ''}">${f ? (f.kind === 'gem' ? '💎' : '<i class="coin"></i>') : ''}</div>`;
            }
        }
        html += '</div>';
        stage.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${html}
            <div style="font-size:12px;opacity:.9">Escavações restantes: <b>${t.digsLeft}</b> · Tesouros: <b>${t.found.length}/${t.total}</b> · cave linhas e colunas — o tesouro aparece onde as duas se cruzam</div></div>`;
        stage.querySelectorAll('[data-line]').forEach((el) => {
            el.onclick = () => this._send({ line: el.dataset.line, index: Number(el.dataset.i) });
        });
    }

    // ---------------------------------------------------------------- Card-Jitsu
    _cardHtml(c, cls = '') {
        if (!c) return `<div class="card back ${cls}"></div>`;
        return `<div class="card ${cls}" style="border-color:${COLOR_HEX[c.color] || '#999'}"><span class="el">${ELEMENT_ICON[c.element]}</span><span class="v">${c.value}</span></div>`;
    }

    _card(stage) {
        const s = this.st, t = s.state;
        const me = t.seats[s.you], op = t.seats[1 - s.you];
        const winIds = new Set((t.winSet?.cards || []).map((c) => JSON.stringify(c)));
        const bank = (arr) => arr.map((c) => this._cardHtml(c, `mini${winIds.has(JSON.stringify(c)) ? ' win' : ''}`)).join('') || '<span class="lbl">nenhuma carta ainda</span>';
        const mine = this._myTurn();
        let battle = '<span class="lbl">Fogo derrete neve · neve congela água · água apaga fogo</span>';
        if (t.last) {
            const [a, b] = t.last.cards;
            const my = s.you === 0 ? a : b, their = s.you === 0 ? b : a;
            const w = t.last.winner;
            const res = w === null ? 'Empate' : w === s.you ? 'Você ganhou a rodada!' : 'O oponente ganhou a rodada';
            battle = `${this._cardHtml(my, w !== null && w !== s.you ? 'lost' : '')}<span class="vs">VS</span>${this._cardHtml(their, w !== null && w === s.you ? 'lost' : '')}
                <span class="lbl" style="max-width:110px">${res}</span>`;
        }
        stage.innerHTML = `<div class="cj">
            <div class="lbl">Cartas ganhas pelo oponente</div><div class="row">${bank(op.bank)}</div>
            <div class="row">${op.hand.map(() => this._cardHtml(null, 'mini')).join('')}</div>
            <div class="battle">${battle}</div>
            <div class="row">${me.hand.map((c, i) => this._cardHtml(c, `${mine ? 'pick' : ''}${me.picked === i ? ' sel' : ''}`).replace('<div class="card', `<div data-card="${i}" class="card`)).join('')}</div>
            <div class="lbl">Suas cartas ganhas — junte 3 do mesmo elemento ou 1 de cada, com cores diferentes</div><div class="row">${bank(me.bank)}</div>
        </div>`;
        if (!mine) return;
        stage.querySelectorAll('[data-card]').forEach((el) => {
            el.onclick = () => this._send({ card: Number(el.dataset.card) });
        });
    }
}
