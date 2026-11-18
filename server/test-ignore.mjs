// test-ignore.mjs — ignore cobre chat E emotes/actions (issue #28)
// Uso: node test-ignore.mjs  (requer servidor ws://localhost:8090 + PENGUIN_DB temp)
import WebSocket from 'ws';

const SMOKE_PORT = (process.env.SMOKE_WS_URL || 'ws://localhost:8090').split(':').pop();
const URL = `ws://localhost:${SMOKE_PORT}`;
let failures = 0;
const check = (n, c, x = '') => { if (c) console.log(`  PASS ${n}`); else { failures++; console.log(`  FAIL ${n} ${x}`); } };

function connect(url = URL) {
    return new Promise((res, rej) => {
        const ws = new WebSocket(url);
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
        waitFor: (pred, ms = 4000) => new Promise((res, rej) => {
            const hit = inbox.slice(mark).find(pred);
            if (hit) return res(hit);
            const t = setTimeout(() => rej(new Error('timeout waitFor')), ms);
            waiters.push({ pred, resolve: (p) => { clearTimeout(t); res(p); } });
        }),
        inbox,
        mark: () => { mark = inbox.length; },
        since: () => inbox.slice(mark),
    };
}

async function onboard(c) {
    c.send('AUTH_GUEST', { forceGuest: true });
    const pd = await c.waitOp('PLAYER_DATA');
    return pd.data;
}

// dois clientes (IPv6 vs IPv4 = IPs distintos p/ o servidor)
const wsA = await connect(`ws://localhost:${SMOKE_PORT}`); const A = makeClient(wsA);
const wsB = await connect(`ws://127.0.0.1:${SMOKE_PORT}`); const B = makeClient(wsB);

const dA = await onboard(A);
const dB = await onboard(B);

A.send('JOIN_ROOM', { roomId: 'town', x: 100, y: 100 });
await A.waitOp('ROOM_STATE');
B.send('JOIN_ROOM', { roomId: 'town', x: 200, y: 200 });
await B.waitOp('ROOM_STATE');

console.log('== baseline: sem ignore ==');
A.mark();
B.send('PLAYER_ACTION', { action: 'wave' });
const act0 = await A.waitFor((p) => p.op === 'PLAYER_ACTION' && p.data?.playerId === dB.playerId);
check('A recebeu emote de B (baseline)', act0.data.action === 'wave');

A.mark();
B.send('SEND_CHAT', { message: 'oi tudo bem' });
const chat0 = await A.waitFor((p) => p.op === 'SEND_CHAT' && p.data?.playerId === dB.playerId);
check('A recebeu chat de B (baseline)', chat0.data.message === 'oi tudo bem');

console.log('== A ignora B ==');
A.send('IGNORE_ADD', { playerId: dB.playerId });
const soc = await A.waitOp('SOCIAL_UPDATE');
check('SOCIAL_UPDATE lista B nos ignores de A',
    soc.data?.ignores?.some((i) => i.playerId === dB.playerId), JSON.stringify(soc.data?.ignores));

console.log('== emote/chat de B nao chega mais em A ==');
A.mark();
B.send('PLAYER_ACTION', { action: 'dance' });
B.send('SEND_CHAT', { message: 'mensagem ignorada' });
// espera um pouco e confere o inbox de A: nao pode ter PLAYER_ACTION/SEND_CHAT de B
await new Promise((r) => setTimeout(r, 1200));
const leaked = A.since().filter((p) =>
    (p.op === 'PLAYER_ACTION' || p.op === 'SEND_CHAT') && p.data?.playerId === dB.playerId);
check('A NAO recebeu emote de B ignorado', leaked.filter((p) => p.op === 'PLAYER_ACTION').length === 0,
    JSON.stringify(leaked.map((p) => p.op)));
check('A NAO recebeu chat de B ignorado', leaked.filter((p) => p.op === 'SEND_CHAT').length === 0,
    JSON.stringify(leaked.map((p) => p.op)));

console.log('== direcao contraria continua funcionando ==');
B.mark();
A.send('PLAYER_ACTION', { action: 'sit' });
A.send('SEND_CHAT', { message: 'eu ignoro mas falo' });
const actB = await B.waitFor((p) => p.op === 'PLAYER_ACTION' && p.data?.playerId === dA.playerId);
const chatB = await B.waitFor((p) => p.op === 'SEND_CHAT' && p.data?.playerId === dA.playerId);
check('B recebeu emote de A', actB.data.action === 'sit');
check('B recebeu chat de A', chatB.data.message === 'eu ignoro mas falo');

console.log('== unignore restaura ==');
A.send('IGNORE_REMOVE', { playerId: dB.playerId });
await A.waitOp('SOCIAL_UPDATE');
A.mark();
B.send('PLAYER_ACTION', { action: 'wave' });
const act2 = await A.waitFor((p) => p.op === 'PLAYER_ACTION' && p.data?.playerId === dB.playerId, 4000)
    .catch(() => null);
check('apos unignore, emote de B volta a chegar', !!act2 && act2.data.action === 'wave');

wsA.close(); wsB.close();
console.log(failures === 0 ? '\nTODOS OS TESTES IGNORE PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
