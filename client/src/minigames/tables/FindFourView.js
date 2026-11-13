// FindFourView.js — tela do Find Four.
//
// Visual: kit vetorial do usuario (public/minigames/findfour/svg — moldura,
// tabuleiro, fichas e botao X em camadas, palco nativo 471x665).
// Do FindFour.swf original vem o que o kit nao tinha:
//   - sons: sound_drop (ficha encaixando), sound_gromb (coluna cheia) e
//     sound_win, tocados a 50% como no playSound(clip, 50) do AS2;
//   - tipografia: nomes em CCFaceFront Bold 16px, MAIUSCULOS — na vez do
//     jogador branco com brilho preto (frame "Turn"), esperando #d5f1ff com
//     brilho #336699 (frame "Wait"); lugar vazio = "Waiting for Player" em
//     Arial 12px, sem ficha;
//   - a ficha da SUA cor acima da coluna sob o mouse (estado "over" dos
//     botoes do turn_mc: a ficha 20% maior, uma casa acima do tabuleiro),
//     no lugar da seta do kit;
//   - a queda: sai dessa posicao e desce uma casa por frame a 24fps, sem
//     quique (coindrop1/2), com o som no encaixe.
// As regras ficam no servidor (tables.js): aqui so desenhamos o TABLE_STATE.

import { playSfx, preloadSfx } from '../../audio/Sfx.js';

const BASE = '/minigames/findfour';
const SND = { drop: `${BASE}/audio/drop.mp3`, gromb: `${BASE}/audio/gromb.mp3`, win: `${BASE}/audio/win.wav` };
const COLS = 7, ROWS = 6;
// geometria do kit (palco 471x665): centros das casas e passo
const W = 471, H = 665, X0 = 82, Y0 = 160, STEP = 51, TOKEN = 44;
// SWF original: casa = 24.3px; ficha "over" em y = -20 (escala 1.2)
const K = STEP / 24.3;
const HOVER_Y = Y0 - 20 * K;         // centro da ficha acima do tabuleiro
const HOVER_SIZE = TOKEN * 1.2;
const FRAME_MS = 1000 / 24;
const COLOR = ['red', 'cyan'];        // lugar 0 = vermelho, lugar 1 = azul
const pctX = (v) => `${(v / W) * 100}%`;
const pctY = (v) => `${(v / H) * 100}%`;

export const FIND_FOUR_CSS = `
@font-face{font-family:'CCFaceFront CP';src:url('${BASE}/fonts/ccfacefront-bold.ttf') format('truetype');font-weight:700;font-display:swap}
.cp-tg.four .win{display:flex;flex-direction:column;background:none;border:0;box-shadow:none;overflow:visible;width:min(360px,92vw,calc((100vh - 150px) * ${W} / ${H}))}
.cp-tg.four .top,.cp-tg.four .players{display:none}
.cp-tg.four .stage{padding:0;order:1}
.cp-tg.four .status{order:2}.cp-tg.four .timer{order:3}.cp-tg.four .err{order:4}.cp-tg.four .foot{order:5}
.cp-tg.four .status{font-family:'CCFaceFront CP',Arial,sans-serif;font-weight:700;font-size:15px;text-shadow:0 0 3px #000,0 0 3px #000,0 0 3px #000;padding:6px 8px 4px}
.cp-tg.four .timer{margin:0 18% 8px}
.cp-tg.four .foot{padding:0 0 4px}
.ffk{position:relative;width:100%;aspect-ratio:${W}/${H};container-type:inline-size;user-select:none;touch-action:manipulation;filter:drop-shadow(0 12px 16px rgba(0,20,50,.45))}
.ffk img{display:block;position:absolute;pointer-events:none;-webkit-user-drag:none}
.ffk .fr{inset:0;width:100%;height:100%}
.ffk .gr{left:${pctX(44)};top:${pctY(127)};width:${pctX(383)};height:${pctY(320)}}
.ffk .pc{width:${pctX(TOKEN)};height:${pctY(TOKEN)}}
.ffk .pc.winner{animation:ffk-win .64s ease-in-out infinite alternate}
@keyframes ffk-win{from{filter:drop-shadow(0 0 1px #fff) brightness(1)}to{filter:drop-shadow(0 0 8px #fff67b) brightness(1.4)}}
.ffk .hv{width:${pctX(HOVER_SIZE)};height:${pctY(HOVER_SIZE)};top:${pctY(HOVER_Y - HOVER_SIZE / 2)};opacity:0;z-index:2}
.ffk .hv.on{opacity:1}
.ffk .col{position:absolute;top:${pctY(HOVER_Y - HOVER_SIZE / 2)};height:${pctY(127 + 320 - (HOVER_Y - HOVER_SIZE / 2))};width:${pctX(STEP)};padding:0;border:0;background:transparent;z-index:3;cursor:default}
.ffk.my .col{cursor:pointer}
.ffk .lg{left:${pctX(76)};width:${pctX(53)};height:${pctY(53)}}
.ffk .lg.p0{top:${pctY(488)}}.ffk .lg.p1{top:${pctY(551)}}
.ffk .nm{position:absolute;left:${pctX(149)};max-width:62%;white-space:nowrap;overflow:hidden;line-height:1.2;pointer-events:none;
  font-family:'CCFaceFront CP','Arial Black',Arial,sans-serif;font-weight:700;font-size:${((16 * K) / W * 100).toFixed(2)}cqw;text-transform:uppercase}
.ffk .nm.p0{top:${pctY(494)}}.ffk .nm.p1{top:${pctY(557)}}
.ffk .nm.wait{color:#d5f1ff;text-shadow:0 0 .9cqw #336699,0 0 .9cqw #336699,0 0 .9cqw #336699,0 0 .9cqw #336699,0 0 .5cqw #336699,0 0 .5cqw #336699}
.ffk .nm.turn{color:#fff;text-shadow:0 0 .9cqw #000,0 0 .9cqw #000,0 0 .9cqw #000,0 0 .9cqw #000,0 0 .5cqw #000,0 0 .5cqw #000}
.ffk .nm.empty{color:#fff;text-shadow:none;text-transform:none;font-family:Arial,Helvetica,sans-serif;font-weight:400;font-size:${((12 * K) / W * 100).toFixed(2)}cqw;left:${pctX(118)};padding-top:.6cqw}
.ffk .x{position:absolute;left:84.5%;top:7.07%;width:11.9%;height:8.42%;border:0;background:url('${BASE}/svg/close-default.svg') center/100% 100% no-repeat;padding:0;cursor:pointer;z-index:4}
.ffk .x:hover{background-image:url('${BASE}/svg/close-hover.svg')}
`;

export default class FindFourView {
    // onMove(col) envia a jogada; onClose() fecha a mesa
    constructor(stage, { onMove, onClose }) {
        this.onMove = onMove;
        this.pieces = new Map(); // indice da casa -> <img>
        this.st = null;
        this.hoverCol = -1;
        this.won = false;
        for (const u of Object.values(SND)) preloadSfx(u);

        const el = document.createElement('div');
        el.className = 'ffk';
        el.innerHTML = `<img class="fr" src="${BASE}/svg/frame.svg" alt="">
            <img class="gr" src="${BASE}/svg/grid.svg" alt="">
            <div class="tk"></div>
            <img class="hv" alt="">
            <img class="lg p0" src="${BASE}/svg/token-red.svg" alt=""><img class="lg p1" src="${BASE}/svg/token-cyan.svg" alt="">
            <span class="nm p0"></span><span class="nm p1"></span>
            <button class="x" type="button" title="Fechar"></button>`;
        this.el = el;
        this.tokens = el.querySelector('.tk');
        this.hover = el.querySelector('.hv');
        el.querySelector('.x').onclick = onClose;
        for (let c = 0; c < COLS; c++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'col';
            b.style.left = pctX(X0 + STEP * c - STEP / 2);
            b.setAttribute('aria-label', `Coluna ${c + 1}`);
            b.addEventListener('pointerenter', () => { this.hoverCol = c; this._syncHover(); });
            b.addEventListener('pointerleave', () => { if (this.hoverCol === c) { this.hoverCol = -1; this._syncHover(); } });
            b.addEventListener('click', () => this._click(c));
            el.appendChild(b);
        }
        stage.innerHTML = '';
        stage.appendChild(el);
    }

    _myTurn() {
        const s = this.st;
        return !!s && s.status === 'playing' && s.turn === s.you;
    }

    _colFull(c) { return !!this.st?.state?.board?.[c]; } // linha 0 = topo

    // ficha da SUA cor acima da coluna sob o mouse (so na sua vez)
    _syncHover() {
        const c = this.hoverCol;
        const on = this._myTurn() && c >= 0 && !this._colFull(c);
        this.el.classList.toggle('my', this._myTurn());
        if (on) {
            this.hover.src = `${BASE}/svg/token-${COLOR[this.st.you]}.svg`;
            this.hover.style.left = pctX(X0 + STEP * c - HOVER_SIZE / 2);
        }
        this.hover.classList.toggle('on', on);
    }

    _click(c) {
        if (!this._myTurn()) return;
        if (this._colFull(c)) { playSfx(SND.gromb, 0.5); return; } // como no click() do AS2
        this.onMove(c);
    }

    _addPiece(i, v, drop) {
        const row = Math.floor(i / COLS), col = i % COLS;
        const img = document.createElement('img');
        img.className = 'pc';
        img.alt = '';
        img.src = `${BASE}/svg/token-${COLOR[v - 1]}.svg`;
        img.style.left = pctX(X0 + STEP * col - TOKEN / 2);
        img.style.top = pctY(Y0 + STEP * row - TOKEN / 2);
        this.tokens.appendChild(img);
        this.pieces.set(i, img);
        if (!drop) return;
        // coindrop do SWF: nasce na posicao da ficha "over" e desce uma
        // casa por frame (24fps), sem quique; som no encaixe
        const scale = this.el.getBoundingClientRect().width / W;
        const from = (HOVER_Y - (Y0 + STEP * row)) * scale;
        const ms = (row + 1) * FRAME_MS;
        let done = false;
        const land = () => { if (!done) { done = true; playSfx(SND.drop, 0.5); } };
        try {
            const a = img.animate(
                [{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }],
                { duration: ms, easing: 'linear' });
            a.finished.then(land, land);
        } catch { land(); }
    }

    update(st) {
        const prev = this.st;
        this.st = st;
        const board = st.state?.board;
        if (board) {
            const last = st.state.last ? st.state.last.row * COLS + st.state.last.col : -1;
            for (let i = 0; i < ROWS * COLS; i++) {
                if (board[i] && !this.pieces.has(i)) this._addPiece(i, board[i], !!prev?.state && i === last);
            }
        }
        // 4 em linha: realce + som de vitoria (uma vez)
        if (st.state?.line && !this.won) {
            this.won = true;
            for (const [r, c] of st.state.line) this.pieces.get(r * COLS + c)?.classList.add('winner');
            const wait = (st.state.last ? st.state.last.row + 1 : 0) * FRAME_MS + 120;
            setTimeout(() => playSfx(SND.win, 0.5), wait);
        }
        // nomes: frames "Turn"/"Wait" do player0_mc/player1_mc
        for (const i of [0, 1]) {
            const seat = st.seats[i];
            const nm = this.el.querySelector(`.nm.p${i}`);
            const lg = this.el.querySelector(`.lg.p${i}`);
            lg.style.display = seat ? '' : 'none';
            if (!seat) { nm.className = `nm p${i} empty`; nm.textContent = 'Waiting for Player'; continue; }
            const turn = st.status === 'playing' && st.turn === i;
            nm.className = `nm p${i} ${turn ? 'turn' : 'wait'}`;
            nm.textContent = seat.username;
        }
        this._syncHover();
    }
}
