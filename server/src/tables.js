/**
 * tables.js — jogos de mesa AUTORITATIVOS (Fase 6, aprofundada).
 *
 * O servidor guarda o tabuleiro, valida cada jogada, controla turnos com
 * prazo, decide o vencedor e paga as moedas — o cliente so envia a jogada
 * ("coluna 3", "casa 2", "carta 4"). Substitui o antigo GAME_STATE, que
 * apenas retransmitia um estado arbitrario entre os jogadores, e o
 * CARDJITSU_RESULT, que aceitava "ganhei" vindo do cliente.
 *
 * Jogos:  four (Find Four) · mancala · treasure (Treasure Hunt, cooperativo)
 *         card (Card-Jitsu, jogadas simultaneas)
 * Mesas:  as das salas (sendJoinTable/sendJoinWaddle dos packs originais:
 *         Book Room = mancala 100-104, Lodge/Attic = four 200-207,
 *         Dojo = card 200-203), o lobby do painel "Sistemas" e partidas
 *         contra o computador.
 *
 * Pacotes (cliente -> servidor):
 *   TABLE_JOIN  { game, room?, tableId?, cpu? }   senta (ou cria vs CPU)
 *   TABLE_CPU   { key }                           sozinho na mesa: chama o CPU
 *   TABLE_MOVE  { key, move }                     jogada
 *   TABLE_LEAVE { key }                           sai (no meio = desistencia)
 * Servidor -> cliente:
 *   TABLE_STATE { key, game, status, you, seats, turn, msLeft, state, result }
 *   TABLE_ERROR { error }
 */

import db from './db.js';
import playerStore from './playerStore.js';

const hooks = { getSocket: null, onCoins: null, getUsername: null };
export function setTableHooks(h) { Object.assign(hooks, h || {}); }

const ALIAS = {
    four: 'four', findfour: 'four',
    mancala: 'mancala',
    treasure: 'treasure', treasurehunt: 'treasure',
    card: 'card', cardjitsu: 'card',
};
const TURN_MS = { four: 30000, mancala: 30000, treasure: 30000, card: 20000 };
const CPU_DELAY_MS = 750;
const REWARD = { win: 25, draw: 10, loss: 5 };
const CPU_FACTOR = 0.5;             // vs computador paga metade
const REWARD_WINDOW_MS = 10 * 60_000;
const REWARD_MAX_GAMES = 12;        // partidas premiadas por janela, por jogador
const CLOSE_AFTER_MS = 15_000;      // mesa encerrada some depois disso

const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// =====================================================================
// Find Four — 7 colunas x 6 linhas, 4 em linha
// =====================================================================
const COLS = 7, ROWS = 6;
const Four = {
    create() {
        return { board: Array(COLS * ROWS).fill(0), turn: 0, last: null, line: null, moves: 0 };
    },
    _drop(board, col) {
        for (let r = ROWS - 1; r >= 0; r--) if (!board[r * COLS + col]) return r;
        return -1;
    },
    _line(board, r, c) {
        const v = board[r * COLS + c];
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            const cells = [[r, c]];
            for (const s of [1, -1]) {
                let rr = r + dr * s, cc = c + dc * s;
                while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === v) {
                    cells.push([rr, cc]); rr += dr * s; cc += dc * s;
                }
            }
            if (cells.length >= 4) return cells;
        }
        return null;
    },
    moves(st) {
        const out = [];
        for (let c = 0; c < COLS; c++) if (!st.board[c]) out.push({ col: c });
        return out;
    },
    apply(st, seat, mv) {
        if (st.turn !== seat) return 'Não é sua vez';
        const col = Math.trunc(Number(mv?.col));
        if (!(col >= 0 && col < COLS)) return 'Coluna inválida';
        const r = this._drop(st.board, col);
        if (r < 0) return 'Coluna cheia';
        st.board[r * COLS + col] = seat + 1;
        st.last = { row: r, col };
        st.moves++;
        st.line = this._line(st.board, r, col);
        if (!st.line) st.turn = 1 - seat;
        return null;
    },
    result(st) {
        if (st.line) return { winner: st.board[st.line[0][0] * COLS + st.line[0][1]] - 1 };
        if (st.moves >= COLS * ROWS) return { winner: null };
        return null;
    },
    view(st) { return st; },
    cpu(st, seat) {
        const opts = this.moves(st).map((m) => m.col);
        const winsAt = (who, col) => {
            const b = st.board.slice();
            const r = this._drop(b, col);
            if (r < 0) return false;
            b[r * COLS + col] = who + 1;
            return !!this._line(b, r, col);
        };
        for (const c of opts) if (winsAt(seat, c)) return { col: c };          // ganha
        for (const c of opts) if (winsAt(1 - seat, c)) return { col: c };      // bloqueia
        // evita entregar a vitoria na jogada por cima
        const safe = opts.filter((c) => {
            const b = st.board.slice();
            const r = this._drop(b, c);
            b[r * COLS + c] = seat + 1;
            if (r - 1 < 0) return true;
            b[(r - 1) * COLS + c] = 2 - seat;
            return !this._line(b, r - 1, c);
        });
        const pool = safe.length ? safe : opts;
        pool.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + (Math.random() - 0.5) * 1.6);
        return { col: pool[0] };
    },
};

// =====================================================================
// Mancala (Kalah) — 6 casas + loja por lado, 4 pedras; ultima pedra na
// propria loja = jogada extra; na propria casa vazia = captura.
// pits[0..5] lado 0, pits[6] loja 0, pits[7..12] lado 1, pits[13] loja 1
// =====================================================================
const Mancala = {
    create() {
        const pits = Array(14).fill(4);
        pits[6] = 0; pits[13] = 0;
        return { pits, turn: 0, last: null, extra: false, capture: null, over: false };
    },
    _side: (seat) => (seat === 0 ? [0, 5, 6, 13] : [7, 12, 13, 6]),
    moves(st) {
        const [a, b] = this._side(st.turn);
        const out = [];
        for (let i = a; i <= b; i++) if (st.pits[i]) out.push({ pit: i - a });
        return out;
    },
    _sow(st, seat, local) {
        const [a, , store, oppStore] = this._side(seat);
        const p = st.pits;
        let i = a + local, stones = p[i];
        p[i] = 0;
        while (stones) {
            i = (i + 1) % 14;
            if (i === oppStore) continue;
            p[i]++; stones--;
        }
        st.extra = i === store;
        st.capture = null;
        const own = seat === 0 ? i >= 0 && i <= 5 : i >= 7 && i <= 12;
        if (own && p[i] === 1 && p[12 - i] > 0) {
            st.capture = { pit: i, from: 12 - i, stones: p[12 - i] + 1 };
            p[store] += p[12 - i] + 1;
            p[i] = 0; p[12 - i] = 0;
        }
        st.last = { seat, pit: local, end: i };
        // fim: um lado vazio -> o resto vai para a loja do dono
        const empty = (s, e) => p.slice(s, e + 1).every((x) => !x);
        if (empty(0, 5) || empty(7, 12)) {
            for (let k = 0; k <= 5; k++) { p[6] += p[k]; p[k] = 0; }
            for (let k = 7; k <= 12; k++) { p[13] += p[k]; p[k] = 0; }
            st.over = true;
        }
    },
    apply(st, seat, mv) {
        if (st.turn !== seat) return 'Não é sua vez';
        const local = Math.trunc(Number(mv?.pit));
        if (!(local >= 0 && local <= 5)) return 'Casa inválida';
        const [a] = this._side(seat);
        if (!st.pits[a + local]) return 'Casa vazia';
        this._sow(st, seat, local);
        if (!st.over && !st.extra) st.turn = 1 - seat;
        return null;
    },
    result(st) {
        if (!st.over) return null;
        const d = st.pits[6] - st.pits[13];
        return { winner: d === 0 ? null : d > 0 ? 0 : 1 };
    },
    view(st) { return st; },
    cpu(st, seat) {
        // guloso de 1 jogada: jogada extra > captura/loja > aleatorio
        let best = null, bestScore = -1e9;
        const [, , store] = this._side(seat);
        for (const m of this.moves(st)) {
            const sim = structuredClone(st);
            this._sow(sim, seat, m.pit);
            const score = (sim.pits[store] - st.pits[store]) * 2 + (sim.extra ? 5 : 0) + Math.random();
            if (score > bestScore) { bestScore = score; best = m; }
        }
        return best;
    },
};

// =====================================================================
// Treasure Hunt — cooperativo. Grade 10x10 com 2 camadas de areia: cavar
// uma linha OU coluna tira uma camada; a casa so aparece quando a linha
// E a coluna dela foram cavadas. 12 escavacoes no total (6 por jogador).
// =====================================================================
const TN = 10, DIGS = 12;
const Treasure = {
    create() {
        const cells = shuffle([...Array(TN * TN).keys()]);
        const treasures = {};
        cells.slice(0, 10).forEach((c) => { treasures[c] = { kind: 'coin', value: 5 }; });
        cells.slice(10, 12).forEach((c) => { treasures[c] = { kind: 'gem', value: 25 }; });
        return { treasures, rows: [], cols: [], turn: 0, digs: 0, found: [], score: 0, last: null };
    },
    moves(st) {
        const out = [];
        for (let i = 0; i < TN; i++) {
            if (!st.rows.includes(i)) out.push({ line: 'row', index: i });
            if (!st.cols.includes(i)) out.push({ line: 'col', index: i });
        }
        return out;
    },
    apply(st, seat, mv) {
        if (st.turn !== seat) return 'Não é sua vez';
        const line = mv?.line === 'col' ? 'col' : mv?.line === 'row' ? 'row' : null;
        const index = Math.trunc(Number(mv?.index));
        if (!line || !(index >= 0 && index < TN)) return 'Escavação inválida';
        const list = line === 'row' ? st.rows : st.cols;
        if (list.includes(index)) return 'Já cavado';
        list.push(index);
        st.digs++;
        st.last = { seat, line, index, found: [] };
        // casas que acabaram de ficar descobertas
        for (const r of line === 'row' ? [index] : st.rows) {
            for (const c of line === 'col' ? [index] : st.cols) {
                const cell = r * TN + c;
                const t = st.treasures[cell];
                if (t && !st.found.some((f) => f.cell === cell)) {
                    st.found.push({ cell, ...t, by: seat });
                    st.last.found.push(cell);
                    st.score += t.value;
                }
            }
        }
        st.turn = 1 - seat;
        return null;
    },
    result(st) {
        if (st.digs >= DIGS || st.found.length === Object.keys(st.treasures).length) {
            return { winner: null, coop: true, score: st.score };
        }
        return null;
    },
    // tesouros escondidos nao vao para o cliente (so os ja encontrados)
    view(st) {
        const { treasures, ...rest } = st;
        return { ...rest, digsLeft: DIGS - st.digs, total: Object.keys(treasures).length };
    },
    cpu(st) {
        // nao sabe onde estao os tesouros: escolhe a linha que cruza mais
        // linhas ja cavadas (descobre mais casas)
        const opts = this.moves(st);
        let best = opts[0], bestN = -1;
        for (const m of opts) {
            const n = (m.line === 'row' ? st.cols.length : st.rows.length) + Math.random();
            if (n > bestN) { bestN = n; best = m; }
        }
        return best;
    },
};

// =====================================================================
// Card-Jitsu — cada um escolhe uma carta ao mesmo tempo. Fogo derrete
// neve, neve congela agua, agua apaga fogo; mesmo elemento: maior valor.
// Vence quem juntar 3 cartas do mesmo elemento com cores diferentes, ou
// uma de cada elemento com cores diferentes.
// =====================================================================
const ELEMENTS = ['fire', 'water', 'snow'];
const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
const BEATS = { fire: 'snow', snow: 'water', water: 'fire' };
const Card = {
    _deck() {
        const d = [];
        for (let i = 0; i < 24; i++) d.push({ element: ELEMENTS[i % 3], value: 2 + rnd(11), color: COLORS[rnd(COLORS.length)] });
        return shuffle(d);
    },
    create() {
        const seats = [0, 1].map(() => {
            const deck = this._deck();
            return { deck, hand: deck.splice(0, 5), bank: [], picked: null };
        });
        return { seats, round: 0, last: null, winSet: null, turn: null };
    },
    _wins(bank) {
        for (const el of ELEMENTS) {
            const colors = new Set(bank.filter((c) => c.element === el).map((c) => c.color));
            if (colors.size >= 3) {
                const set = []; const used = new Set();
                for (const c of bank) if (c.element === el && !used.has(c.color) && set.length < 3) { used.add(c.color); set.push(c); }
                return set;
            }
        }
        const byEl = ELEMENTS.map((el) => bank.filter((c) => c.element === el));
        for (const a of byEl[0]) for (const b of byEl[1]) for (const c of byEl[2]) {
            if (a.color !== b.color && b.color !== c.color && a.color !== c.color) return [a, b, c];
        }
        return null;
    },
    moves(st, seat) { return st.seats[seat].hand.map((_, i) => ({ card: i })); },
    apply(st, seat, mv) {
        const me = st.seats[seat];
        if (me.picked !== null) return 'Carta já escolhida';
        const i = Math.trunc(Number(mv?.card));
        if (!(i >= 0 && i < me.hand.length)) return 'Carta inválida';
        me.picked = i;
        if (st.seats.every((s) => s.picked !== null)) this._resolve(st);
        return null;
    },
    _resolve(st) {
        const [a, b] = st.seats.map((s) => s.hand[s.picked]);
        let winner = null;
        if (a.element === b.element) winner = a.value === b.value ? null : a.value > b.value ? 0 : 1;
        else winner = BEATS[a.element] === b.element ? 0 : 1;
        st.round++;
        st.last = { cards: [a, b], winner };
        if (winner !== null) st.seats[winner].bank.push(winner === 0 ? a : b);
        for (const s of st.seats) {
            s.hand.splice(s.picked, 1);
            if (!s.deck.length) s.deck = this._deck();
            s.hand.push(s.deck.shift());
            s.picked = null;
        }
        if (winner !== null) {
            const set = this._wins(st.seats[winner].bank);
            if (set) st.winSet = { seat: winner, cards: set };
        }
    },
    result(st) {
        if (st.winSet) return { winner: st.winSet.seat };
        if (st.round >= 30) {
            const [x, y] = st.seats.map((s) => s.bank.length);
            return { winner: x === y ? null : x > y ? 0 : 1 };
        }
        return null;
    },
    // a mao do oponente e a carta que ele escolheu ficam escondidas
    view(st, seat) {
        return {
            round: st.round, last: st.last, winSet: st.winSet,
            seats: st.seats.map((s, i) => ({
                hand: i === seat ? s.hand : s.hand.map(() => null),
                bank: s.bank,
                picked: i === seat ? s.picked : s.picked !== null,
            })),
        };
    },
    cpu(st, seat) {
        // prefere carta que vence a ultima jogada do oponente; senao a maior
        const hand = st.seats[seat].hand;
        const prev = st.last?.cards?.[1 - seat];
        let idx = hand.findIndex((c) => prev && BEATS[c.element] === prev.element);
        if (idx < 0) idx = hand.reduce((bi, c, i) => (c.value > hand[bi].value ? i : bi), 0);
        if (Math.random() < 0.3) idx = rnd(hand.length);
        return { card: idx };
    },
};

const ENGINES = { four: Four, mancala: Mancala, treasure: Treasure, card: Card };

// =====================================================================
// Mesas
// =====================================================================
const tables = new Map();       // key -> mesa
const seatOf = new Map();       // playerId -> key
let lobbySeq = 0;

function send(playerId, op, data) {
    const ws = hooks.getSocket?.(playerId);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op, data }));
}

function stateFor(t, seat) {
    const eng = ENGINES[t.game];
    const simult = t.game === 'card';
    return {
        key: t.key, game: t.game, room: t.room, tableId: t.id, status: t.status,
        you: seat,
        seats: t.seats.map((s) => (s ? { username: s.username, cpu: !!s.cpu } : null)),
        turn: simult ? null : t.state?.turn ?? null,
        msLeft: t.deadline ? Math.max(0, t.deadline - Date.now()) : null,
        state: t.state ? eng.view(t.state, seat) : null,
        result: t.result ? { ...t.result, coins: t.result.coins?.[seat] ?? 0 } : null,
    };
}

function broadcast(t) {
    t.seats.forEach((s, i) => { if (s && !s.cpu) send(s.playerId, 'TABLE_STATE', stateFor(t, i)); });
}

function clearTimers(t) {
    clearTimeout(t.turnTimer); t.turnTimer = null;
    clearTimeout(t.cpuTimer); t.cpuTimer = null;
}

function destroy(t) {
    clearTimers(t);
    clearTimeout(t.closeTimer);
    for (const s of t.seats) if (s && seatOf.get(s.playerId) === t.key) seatOf.delete(s.playerId);
    tables.delete(t.key);
}

// quem precisa jogar agora (card-jitsu: os dois, ate escolherem)
function pending(t) {
    if (t.game === 'card') return [0, 1].filter((i) => t.state.seats[i].picked === null);
    return [t.state.turn];
}

function schedule(t) {
    clearTimers(t);
    if (t.status !== 'playing') return;
    t.deadline = Date.now() + TURN_MS[t.game];
    t.turnTimer = setTimeout(() => onTimeout(t), TURN_MS[t.game] + 50);
    const cpuSeat = pending(t).find((i) => t.seats[i]?.cpu);
    if (cpuSeat !== undefined) {
        t.cpuTimer = setTimeout(() => {
            if (t.status !== 'playing') return;
            move(t, cpuSeat, ENGINES[t.game].cpu(t.state, cpuSeat));
        }, CPU_DELAY_MS + rnd(500));
    }
}

// prazo estourado: joga automaticamente por quem nao jogou (mais amigavel
// que desclassificar; quem saiu de verdade cai em leave/disconnect)
function onTimeout(t) {
    if (t.status !== 'playing') return;
    const eng = ENGINES[t.game];
    for (const seat of pending(t)) {
        const opts = eng.moves(t.state, seat);
        if (!opts.length) continue;
        move(t, seat, opts[rnd(opts.length)], true);
        if (t.status !== 'playing') return;
    }
}

function start(t) {
    t.status = 'playing';
    t.state = ENGINES[t.game].create();
    t.result = null;
    schedule(t);
    broadcast(t);
}

function rewardAllowed(playerId) {
    const now = Date.now();
    const log = (rewardLog.get(playerId) || []).filter((x) => now - x < REWARD_WINDOW_MS);
    rewardLog.set(playerId, log);
    if (log.length >= REWARD_MAX_GAMES) return false;
    log.push(now);
    return true;
}
const rewardLog = new Map();

function finish(t, res, { forfeit = null } = {}) {
    clearTimers(t);
    t.status = 'over';
    t.deadline = null;
    const vsCpu = t.seats.some((s) => s?.cpu);
    const coins = [0, 0];
    t.seats.forEach((s, i) => {
        if (!s || s.cpu || i === forfeit) return;
        let amount;
        if (res.coop) amount = res.score;
        else if (res.winner === null) amount = REWARD.draw;
        else amount = res.winner === i ? REWARD.win : REWARD.loss;
        if (vsCpu) amount = Math.round(amount * CPU_FACTOR);
        if (amount > 0 && rewardAllowed(s.playerId)) {
            coins[i] = amount;
            playerStore.addCoins(s.playerId, amount);
            hooks.onCoins?.(s.playerId, amount);
        }
        if (t.game === 'card') recordCardJitsu(s.playerId, res.winner === i);
    });
    t.result = { ...res, forfeit, coins };
    broadcast(t);
    t.closeTimer = setTimeout(() => { if (tables.get(t.key) === t) destroy(t); }, CLOSE_AFTER_MS);
}

function recordCardJitsu(playerId, won) {
    try {
        db.prepare(`INSERT INTO cardjitsu (player_id, xp, level, wins, losses, updated_at) VALUES (?,?,?,?,?,?)
                    ON CONFLICT(player_id) DO UPDATE SET
                      xp = cardjitsu.xp + excluded.xp,
                      wins = cardjitsu.wins + excluded.wins,
                      losses = cardjitsu.losses + excluded.losses,
                      level = MIN(10, 1 + (cardjitsu.xp + excluded.xp) / 500),
                      updated_at = excluded.updated_at`)
            .run(playerId, won ? 100 : 25, 1, won ? 1 : 0, won ? 0 : 1, Date.now());
    } catch (e) { console.warn('[tables] cardjitsu', e.message); }
}

function move(t, seat, mv, auto = false) {
    const eng = ENGINES[t.game];
    const err = eng.apply(t.state, seat, mv);
    if (err) return err;
    const res = eng.result(t.state);
    if (res) finish(t, res);
    else { schedule(t); broadcast(t); }
    if (auto) t.autoMoves = (t.autoMoves || 0) + 1;
    return null;
}

// Sai da mesa atual. No meio da partida = desistencia (o outro vence).
export function leaveAll(playerId) {
    const key = seatOf.get(playerId);
    if (!key) return;
    seatOf.delete(playerId);
    const t = tables.get(key);
    if (!t) return;
    const seat = t.seats.findIndex((s) => s?.playerId === playerId);
    if (seat < 0) return;
    if (t.status === 'playing') {
        const other = t.seats[1 - seat];
        if (other && !other.cpu && t.game !== 'treasure') finish(t, { winner: 1 - seat }, { forfeit: seat });
        else if (other && !other.cpu) finish(t, { winner: null, coop: true, score: t.state.score }, { forfeit: seat });
        else { t.seats[seat] = null; destroy(t); return; }
        t.seats[seat] = null;
        return;
    }
    t.seats[seat] = null;
    if (t.seats.every((s) => !s || s.cpu)) destroy(t);
    else if (t.status === 'waiting') broadcast(t);
    // mesa encerrada: o outro continua vendo o resultado ate fechar
}

// Trocou de sala: sai das mesas FISICAS de outra sala (partidas do painel
// e contra o computador nao dependem de sala e continuam)
export function leaveRoomTables(playerId, newRoom) {
    const t = tables.get(seatOf.get(playerId) || '');
    if (t && t.room && t.room !== newRoom) leaveAll(playerId);
}

function newTable(key, game, room, id) {
    const t = { key, game, room, id, seats: [null, null], status: 'waiting', state: null, result: null, deadline: null };
    tables.set(key, t);
    return t;
}

function seat(t, playerId, username) {
    const i = t.seats.findIndex((s) => !s);
    t.seats[i] = { playerId, username };
    seatOf.set(playerId, t.key);
    return i;
}

function fail(ws, error) {
    ws.send(JSON.stringify({ op: 'TABLE_ERROR', data: { error } }));
}

export function handleTableOp(ws, session, packet) {
    const { op, data = {} } = packet;
    if (!op || !op.startsWith('TABLE_')) return false;
    const pid = session.playerId;
    const username = session.username || hooks.getUsername?.(pid) || 'Penguin';

    if (op === 'TABLE_JOIN') {
        const game = ALIAS[String(data.game || '').toLowerCase()];
        if (!game) { fail(ws, data.game === 'sled' ? 'Corrida de trenó ainda não disponível' : 'Jogo desconhecido'); return true; }
        leaveAll(pid);
        if (data.cpu) {
            const t = newTable(`cpu:${game}:${pid}:${Date.now()}`, game, null, null);
            seat(t, pid, username);
            t.seats[1] = { playerId: null, username: 'Computador', cpu: true };
            start(t);
            return true;
        }
        let t;
        if (data.tableId !== undefined && data.room) {
            const key = `room:${String(data.room).substring(0, 20)}:${game}:${Math.trunc(Number(data.tableId))}`;
            t = tables.get(key);
            if (t && t.status === 'over') { destroy(t); t = null; }
            if (t && !t.seats.some((s) => !s)) { fail(ws, 'Mesa ocupada'); return true; }
            t = t || newTable(key, game, String(data.room), Math.trunc(Number(data.tableId)));
        } else {
            // lobby do painel: entra na primeira mesa com lugar, ou abre uma
            t = [...tables.values()].find((x) => x.room === null && x.id === 'lobby' && x.game === game
                && x.status === 'waiting' && x.seats.some((s) => !s));
            t = t || newTable(`lobby:${game}:${++lobbySeq}`, game, null, 'lobby');
        }
        seat(t, pid, username);
        if (t.seats.every((s) => s)) start(t);
        else broadcast(t);
        return true;
    }

    const t = tables.get(String(data.key || seatOf.get(pid) || ''));
    const mySeat = t ? t.seats.findIndex((s) => s?.playerId === pid) : -1;
    if (!t || mySeat < 0) {
        if (op === 'TABLE_LEAVE') return true;
        fail(ws, 'Você não está nesta mesa');
        return true;
    }

    if (op === 'TABLE_CPU') {
        if (t.status !== 'waiting') { fail(ws, 'A partida já começou'); return true; }
        t.seats[1 - mySeat] = { playerId: null, username: 'Computador', cpu: true };
        start(t);
        return true;
    }
    if (op === 'TABLE_MOVE') {
        if (t.status !== 'playing') { fail(ws, 'Partida não está em andamento'); return true; }
        const err = move(t, mySeat, data.move);
        if (err) fail(ws, err);
        return true;
    }
    if (op === 'TABLE_LEAVE') {
        leaveAll(pid);
        return true;
    }
    fail(ws, 'Operação desconhecida');
    return true;
}

// usado pelos testes
export const _engines = ENGINES;
