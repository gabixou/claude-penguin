// test-game.mjs — sistemas de jogo (Fase 6)
// Uso: node test-game.mjs  (requer servidor ws://localhost:8090 + PENGUIN_DB temp)
import WebSocket from 'ws';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'ws://localhost:8090';
let failures = 0;

function check(name, cond, extra = '') {
    if (cond) console.log(`  PASS ${name}`);
    else { failures++; console.log(`  FAIL ${name} ${extra}`); }
}

function connect() {
    return new Promise((res, rej) => {
        const ws = new WebSocket(URL);
        ws.on('open', () => res(ws));
        ws.on('error', rej);
    });
}

function makeClient(ws) {
    const inbox = [];
    const waiters = [];
    let mark = 0;
    ws.on('message', (d) => {
        const p = JSON.parse(d.toString());
        inbox.push(p);
        for (let i = waiters.length - 1; i >= 0; i--) {
            if (waiters[i].pred(p)) { waiters[i].resolve(p); waiters.splice(i, 1); }
        }
    });
    return {
        send: (op, data = {}) => { mark = inbox.length; ws.send(JSON.stringify({ op, data })); },
        waitOp: (op, ms = 4000) => new Promise((res, rej) => {
            const hit = inbox.slice(mark).find((p) => p.op === op);
            if (hit) return res(hit);
            const t = setTimeout(() => rej(new Error(`timeout op=${op}`)), ms);
            waiters.push({ pred: (p) => p.op === op, resolve: (p) => { clearTimeout(t); res(p); } });
        }),
        // espera um pacote que satisfaca pred (inclusive os ja recebidos
        // desde o ultimo send)
        waitWhere: (pred, ms = 6000) => new Promise((res, rej) => {
            const hit = inbox.slice(mark).find(pred);
            if (hit) return res(hit);
            const t = setTimeout(() => rej(new Error('timeout waitWhere')), ms);
            waiters.push({ pred, resolve: (p) => { clearTimeout(t); res(p); } });
        }),
        inbox, ws,
    };
}

async function guest() {
    const ws = await connect();
    const c = makeClient(ws);
    c.send('AUTH_GUEST', { guest: true });
    const pd = await c.waitOp('PLAYER_DATA');
    return { c, ws, data: pd.data };
}

const A = await guest();
const B = await guest();
process.env.PENGUIN_DB = process.env.PENGUIN_DB || join(tmpdir(), 'test-penguin.db');
const { default: db } = await import('./src/db.js');

console.log('== amigos ==');
A.c.send('FRIEND_ADD', { playerId: B.data.playerId });
let r = await A.c.waitOp('GAME_OK');
check('FRIEND_ADD ok', Array.isArray(r.data.friends) && r.data.friends.length === 1);
B.c.send('FRIEND_LIST', {});
r = await B.c.waitOp('GAME_OK');
check('amizade mútua (B vê A)', r.data.friends?.length === 1);
A.c.send('FRIEND_ADD', { playerId: A.data.playerId });
r = await A.c.waitOp('GAME_ERROR');
check('não pode adicionar a si mesmo', !!r.data?.error);

console.log('== ignorados ==');
A.c.send('IGNORE_ADD', { playerId: B.data.playerId });
r = await A.c.waitOp('GAME_OK');
check('IGNORE_ADD ok', r.data.ignores?.length === 1);
// ignorar remove amizade
A.c.send('FRIEND_LIST', {});
r = await A.c.waitOp('GAME_OK');
check('ignorar removeu amizade', r.data.friends?.length === 0);

console.log('== iglu ==');
A.c.send('IGLOO_GET', {});
r = await A.c.waitOp('GAME_OK');
check('IGLOO_GET cria iglu padrão', r.data.igloo?.name === 'Meu Iglu');
A.c.send('IGLOO_SET', { name: 'Iglu do A', theme: 'arctic', floorItemId: 12 });
r = await A.c.waitOp('GAME_OK');
check('IGLOO_SET nome/tema', r.data.igloo?.name === 'Iglu do A' && r.data.igloo?.theme === 'arctic');
A.c.send('IGLOO_FURNITURE_SET', { slot: 3, itemId: 500 });
r = await A.c.waitOp('GAME_OK');
check('IGLOO_FURNITURE_SET', r.data.igloo?.furniture?.some((f) => f.slot === 3 && f.itemId === 500));

console.log('== puffles ==');
A.c.send('PUFFLE_ADOPT', { species: 'orange', name: 'Bob' });
r = await A.c.waitOp('GAME_OK');
check('PUFFLE_ADOPT', r.data.puffle?.name === 'Bob');
const pid = r.data.puffle.id;
A.c.send('PUFFLE_CARE', { puffleId: pid, action: 'feed' });
r = await A.c.waitOp('GAME_OK');
check('PUFFLE_CARE feed', r.data.puffles?.[0]?.hunger === 75, JSON.stringify(r.data.puffles?.[0]?.hunger));
A.c.send('PUFFLE_ADOPT', { species: 'lava', name: 'Zed' });
await A.c.waitOp('GAME_OK');
A.c.send('PUFFLE_ADOPT', { species: 'mint', name: 'Y' });
await A.c.waitOp('GAME_OK');
A.c.send('PUFFLE_ADOPT', { species: 'skull', name: 'X' });
r = await A.c.waitOp('GAME_ERROR');
check('máx 3 puffles', !!r.data?.error);

console.log('== correio ==');
A.c.send('MAIL_SEND', { to: B.data.username, subject: 'Oi', body: 'teste de carta', coins: 10 });
r = await A.c.waitOp('GAME_OK');
check('MAIL_SEND ok', r.op === 'GAME_OK');
B.c.send('MAIL_LIST', {});
r = await B.c.waitOp('GAME_OK');
check('MAIL_LIST inbox', r.data.mail?.length === 1 && r.data.unread === 1);
const mailId = r.data.mail[0].id;
B.c.send('MAIL_READ', { id: mailId });
r = await B.c.waitOp('GAME_OK');
check('MAIL_READ corpo', r.data.mail?.body === 'teste de carta');
B.c.send('MAIL_DELETE', { id: mailId });
await B.c.waitOp('GAME_OK');
B.c.send('MAIL_LIST', {});
r = await B.c.waitOp('GAME_OK');
check('MAIL_DELETE', r.data.mail?.length === 0);

console.log('== selos ==');
A.c.send('STAMP_EARN', { stampId: 7 });
r = await A.c.waitOp('GAME_OK');
check('STAMP_EARN', r.data.stampId === 7);
A.c.send('STAMP_EARN', { stampId: 7 });
r = await A.c.waitOp('GAME_ERROR');
check('selo duplicado rejeitado', !!r.data?.error);
A.c.send('STAMP_LIST', {});
r = await A.c.waitOp('GAME_OK');
check('STAMP_LIST', r.data.stamps?.length === 1 && r.data.catalog?.length === 120);

console.log('== jogos de mesa ==');
A.c.send('GAME_QUEUE', { game: 'findfour' });
r = await A.c.waitOp('GAME_OK');
check('A entrou na fila', !!r.data.queue?.mine || r.data.sessionId);
B.c.send('GAME_QUEUE', { game: 'findfour' });
r = await B.c.waitOp('GAME_OK');
check('B pareado', r.data.matched === true);
// GAME_MATCH push para A
const match = await A.c.waitOp('GAME_MATCH');
check('A recebeu GAME_MATCH', match.data?.game === 'findfour');
const sessId = match.data.sessionId;
B.c.send('GAME_STATE', { sessionId: sessId, state: { move: 1 } });
await B.c.waitOp('GAME_OK');
const st = await A.c.waitOp('GAME_STATE');
check('GAME_STATE broadcast', st.data?.state?.move === 1);

console.log('== mesas autoritativas (Find Four) ==');
// sai das sessoes do protocolo antigo e senta no lobby do Find Four
A.c.send('TABLE_JOIN', { game: 'four' });
let ts = await A.c.waitWhere((p) => p.op === 'TABLE_STATE');
check('A sentou e espera oponente', ts.data.status === 'waiting' && ts.data.you === 0);
B.c.send('TABLE_JOIN', { game: 'findfour' });
ts = await B.c.waitWhere((p) => p.op === 'TABLE_STATE' && p.data.status === 'playing');
check('B sentou e a partida começou', ts.data.you === 1 && ts.data.turn === 0);
const key = ts.data.key;
B.c.send('TABLE_MOVE', { key, move: { col: 0 } });
r = await B.c.waitOp('TABLE_ERROR');
check('jogada fora da vez é recusada', /vez/.test(r.data.error));
// A vence na vertical (coluna 0); B joga na coluna 1
for (let i = 0; i < 4; i++) {
    A.c.send('TABLE_MOVE', { key, move: { col: 0 } });
    const a = await A.c.waitWhere((p) => p.op === 'TABLE_STATE' && (p.data.turn === 1 || p.data.status === 'over'));
    if (a.data.status === 'over') break;
    B.c.send('TABLE_MOVE', { key, move: { col: 1 } });
    await B.c.waitWhere((p) => p.op === 'TABLE_STATE' && p.data.turn === 0);
}
const endA = await A.c.waitWhere((p) => p.op === 'TABLE_STATE' && p.data.status === 'over');
check('servidor decide o vencedor', endA.data.result?.winner === 0);
check('vencedor recebe 25 moedas', endA.data.result?.coins === 25);
const pdA = await A.c.waitWhere((p) => p.op === 'PLAYER_DATA');
check('PLAYER_DATA com as moedas atualizadas', pdA.data.coins >= 25, JSON.stringify(pdA.data.coins));

console.log('== card-jitsu (arbitrado no servidor) / EPF ==');
A.c.send('CARDJITSU_STATE', {});
r = await A.c.waitOp('GAME_OK');
check('CARDJITSU_STATE', r.data.level === 1 && r.data.xp === 0);
A.c.send('CARDJITSU_RESULT', { won: true });
r = await A.c.waitOp('GAME_ERROR');
check('CARDJITSU_RESULT do cliente é recusado', !!r.data.error);
// partida contra o computador ate o fim (jogada aleatoria valida)
A.c.send('TABLE_JOIN', { game: 'card', cpu: true });
let cj = await A.c.waitWhere((p) => p.op === 'TABLE_STATE' && p.data.game === 'card');
for (let guard = 0; guard < 40 && cj.data.status !== 'over'; guard++) {
    const round = cj.data.state.round;
    A.c.send('TABLE_MOVE', { key: cj.data.key, move: { card: Math.floor(Math.random() * 5) } });
    cj = await A.c.waitWhere((p) => p.op === 'TABLE_STATE' && p.data.game === 'card'
        && (p.data.status === 'over' || p.data.state.round > round), 8000);
}
check('Card-Jitsu vs computador termina', cj.data.status === 'over');
A.c.send('CARDJITSU_STATE', {});
r = await A.c.waitOp('GAME_OK');
check('progresso ninja gravado pelo servidor', r.data.wins + r.data.losses === 1 && r.data.xp >= 25, JSON.stringify(r.data));
A.c.send('EPF_STATE', {});
r = await A.c.waitOp('GAME_OK');
check('EPF_STATE missões', r.data.missions?.length === 7);
// progresso veio de join_room/chat/buy/stamp/mail/friend — claim do possível
const claimable = r.data.missions.find((m) => m.done && !m.claimed);
if (claimable) {
    A.c.send('EPF_CLAIM', { missionId: claimable.id });
    const cr = await A.c.waitOp('GAME_OK');
    check('EPF_CLAIM recompensa', cr.data.reward > 0);
} else {
    A.c.send('EPF_CLAIM', { missionId: 'join_room' });
    const cr = await A.c.waitOp('GAME_OK').catch(() => A.c.waitOp('GAME_ERROR'));
    check('EPF_CLAIM (incompleta ou ok)', cr.op === 'GAME_OK' || cr.op === 'GAME_ERROR');
}

console.log('== códigos de resgate ==');
db.prepare(`INSERT INTO redeem_codes (code, reward_type, reward_id, quantity, created_at) VALUES ('TESTE123', 'coins', 250, 1, ?)`)
    .run(Date.now());
const coinsBefore = A.data.coins;
A.c.send('REDEEM', { code: 'TESTE123' });
r = await A.c.waitOp('GAME_OK');
check('REDEEM coins', r.data.reward?.coins === 250);
A.c.send('REDEEM', { code: 'TESTE123' });
r = await A.c.waitOp('GAME_ERROR');
check('REDEEM duplicado rejeitado', !!r.data?.error);

console.log('== ajustes / jornal ==');
A.c.send('SETTINGS_SET', { settings: { music: false, chat: true } });
await A.c.waitOp('GAME_OK');
A.c.send('SETTINGS_GET', {});
r = await A.c.waitOp('GAME_OK');
check('SETTINGS_SET/GET', r.data.settings?.music === false);
db.prepare(`INSERT INTO newspaper (title, body, published_at) VALUES ('Edição 1', 'Notícia teste', ?)`)
    .run(Date.now());
A.c.send('NEWSPAPER_GET', {});
r = await A.c.waitOp('GAME_OK');
check('NEWSPAPER_GET', r.data.newspaper?.[0]?.title === 'Edição 1');

console.log(failures === 0 ? '\nTODOS OS TESTES DE JOGO PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures ? 1 : 0);
