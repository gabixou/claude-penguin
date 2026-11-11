// test-multi.mjs — teste de sincronizacao multiplayer (2 clientes)
// Uso: node test-multi.mjs  (requer servidor ws://localhost:8090 + PENGUIN_DB temp)
import WebSocket from 'ws';

const URL = 'ws://localhost:8090';
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
        inbox,
    };
}

async function onboard(c) {
    // forceGuest: evita herdar o Arenovisk em conexões de loopback
    c.send('AUTH_GUEST', { forceGuest: true });
    const pd = await c.waitOp('PLAYER_DATA'); // auto-cria Penguin_XXXX
    return pd.data;
}

// ---- setup: dois clientes na mesma sala ----
// localhost resolve ::1 (IPv6) e 127.0.0.1 e IPv4 — IPs distintos no servidor,
// o que permite simular dois jogadores diferentes na mesma maquina
const wsA = await connect('ws://localhost:8090'); const A = makeClient(wsA);
const wsB = await connect('ws://127.0.0.1:8090'); const B = makeClient(wsB);

console.log('== onboarding ==');
const dA = await onboard(A);
const dB = await onboard(B);
check('A e B com playerIds distintos', dA.playerId !== dB.playerId);
check('nomes automaticos distintos', dA.username !== dB.username, `${dA.username} vs ${dB.username}`);

A.send('JOIN_ROOM', { roomId: 'town', x: 100, y: 100 });
await A.waitOp('ROOM_STATE');
B.send('JOIN_ROOM', { roomId: 'town', x: 200, y: 200 });
await B.waitOp('ROOM_STATE');

// A entrou primeiro, entao quem recebe PLAYER_JOINED e o A (vendo B entrar)
const joinB = await A.waitOp('PLAYER_JOINED');
check('A viu B entrar (PLAYER_JOINED)', joinB?.data?.playerId === dB.playerId, JSON.stringify(joinB?.data));
// ROOM_STATE de B (que entrou depois) contem A
const rsB = B.inbox.filter(p => p.op === 'ROOM_STATE').pop();
check('ROOM_STATE de B inclui A', rsB?.data?.players?.some(p => p.playerId === dA.playerId));

console.log('== movimento ==');
A.send('MOVE_PLAYER', { targetX: 300, targetY: 400 });
const mv = await B.waitOp('MOVE_PLAYER');
check('B recebeu movimento de A', mv.data?.playerId === dA.playerId && mv.data?.targetX === 300 && mv.data?.targetY === 400, JSON.stringify(mv.data));

console.log('== chat ==');
A.send('SEND_CHAT', { message: 'waddle on!' });
const chat = await B.waitOp('SEND_CHAT');
check('B recebeu chat de A', chat.data?.playerId === dA.playerId && chat.data?.username === dA.username && chat.data?.message === 'waddle on!', JSON.stringify(chat.data));

console.log('== equip broadcast ==');
A.send('BUY_ITEM', { itemId: 102 }); // Dark Vision Goggles, 10c
await A.waitOp('ITEM_BOUGHT');
A.send('EQUIP_ITEM', { slot: 'face', itemId: 102 });
const eq = await B.waitOp('EQUIP_ITEM');
check('B recebeu equip de A', eq.data?.playerId === dA.playerId && eq.data?.slot === 'face' && eq.data?.itemId === 102, JSON.stringify(eq.data));
check('paperdoll no broadcast', eq.data?.paperdoll?.face === 102, JSON.stringify(eq.data?.paperdoll));

console.log('== cor broadcast ==');
A.send('SET_COLOR', { colorItemId: 5 }); // Red — A nao possui (custa 20), deve falhar
const colErr = await A.waitOp('ERROR');
check('SET_COLOR sem posse falha p/ A', colErr.data?.code === 'ITEM_NOT_OWNED', colErr.data?.code);
A.send('BUY_ITEM', { itemId: 5 }); // compra Red (20c)
await A.waitOp('ITEM_BOUGHT');
A.send('SET_COLOR', { colorItemId: 5 });
const col = await B.waitOp('SET_COLOR');
check('B recebeu cor de A', col.data?.playerId === dA.playerId && col.data?.colorItemId === 5, JSON.stringify(col.data));

console.log('== saida ==');
wsA.close();
await new Promise(r => setTimeout(r, 300));
const left = await B.waitOp('PLAYER_LEFT');
check('B notificado que A saiu', left.data?.playerId === dA.playerId, JSON.stringify(left.data));

wsB.close();
console.log(failures === 0 ? '\nTODOS OS TESTES MULTIPLAYER PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
