// probe-social.mjs - testa fase 1 (buddy/ignore/pets/moderacao) via WS.
// Uso: node tools/probe-social.mjs  (servidor de teste na porta 18099)
import WebSocket from '../server/node_modules/ws/index.js';

const URL = 'ws://localhost:18099';
const results = [];
const ok = (name, cond, extra = '') => {
    results.push([name, !!cond]);
    console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

function client(name) {
    const ws = new WebSocket(URL);
    const c = { ws, name, inbox: [], waiters: [] };
    ws.on('message', (raw) => {
        const p = JSON.parse(raw.toString());
        c.inbox.push(p);
        c.waiters = c.waiters.filter((w) => {
            if (w.pred(p)) { w.res(p); return false; }
            return true;
        });
    });
    c.send = (op, data = {}) => ws.send(JSON.stringify({ op, data }));
    c.waitFor = (pred, ms = 4000) => new Promise((res, rej) => {
        const hit = c.inbox.find(pred);
        if (hit) return res(hit);
        const to = setTimeout(() => rej(new Error(`timeout waiting ${c.name}`)), ms);
        c.waiters.push({ pred, res: (p) => { clearTimeout(to); res(p); } });
    });
    c.until = (pred, ms = 3000) => new Promise((res) => {
        const t0 = Date.now();
        const tick = () => {
            const hit = c.inbox.find(pred);
            if (hit || Date.now() - t0 > ms) return res(hit || null);
            setTimeout(tick, 50);
        };
        tick();
    });
    return c;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(c, username) {
    c.send('LOGIN_PLAYER', { username });
    const pd = await c.waitFor((p) => p.op === 'PLAYER_DATA');
    return pd.data;
}

const A = client('A'); const B = client('B');
await Promise.all([new Promise((r) => A.ws.on('open', r)), new Promise((r) => B.ws.on('open', r))]);

const pa = await login(A, 'ProbeAlpha');
const pb = await login(B, 'ProbeBeta');
ok('login A', pa.username === 'ProbeAlpha');
ok('login B', pb.username === 'ProbeBeta');

A.send('JOIN_ROOM', { roomId: 'town', x: 100, y: 100 });
B.send('JOIN_ROOM', { roomId: 'town', x: 200, y: 100 });
await sleep(300);

// ---------- BUDDY ----------
B.inbox.length = 0; A.inbox.length = 0;
A.send('BUDDY_ADD', { username: 'ProbeBeta' });
const reqB = await B.waitFor((p) => p.op === 'BUDDY_REQUEST');
ok('buddy request push', reqB.data.fromUsername === 'ProbeAlpha');
const socA1 = await A.waitFor((p) => p.op === 'SOCIAL_UPDATE');
ok('buddy pending em A', socA1.data.requests.some((r) => r.direction === 'sent' && r.username === 'ProbeBeta'));
const socB1 = await B.waitFor((p) => p.op === 'SOCIAL_UPDATE');
ok('request recebido em B', socB1.data.requests.some((r) => r.direction === 'received' && r.username === 'ProbeAlpha'));

B.send('BUDDY_ACCEPT', { playerId: pa.playerId });
await sleep(300);
const socA2 = await A.until((p) => p.op === 'SOCIAL_UPDATE' && p.data.buddies?.length === 1);
const socB2 = await B.until((p) => p.op === 'SOCIAL_UPDATE' && p.data.buddies?.length === 1);
ok('buddy aceito em A', !!socA2, JSON.stringify(socA2?.data?.buddies));
ok('buddy aceito em B', !!socB2);

// self/duplicate
A.send('BUDDY_ADD', { username: 'ProbeAlpha' });
const selfErr = await A.waitFor((p) => p.op === 'ERROR');
ok('buddy self rejeitado', selfErr.data.code === 'SELF', selfErr.data.code);
A.inbox.length = 0;
A.send('BUDDY_ADD', { username: 'ProbeBeta' });
const dupErr = await A.until((p) => p.op === 'ERROR');
ok('buddy duplicado rejeitado', dupErr?.data?.code === 'ALREADY_BUDDY', dupErr?.data?.code);

// ---------- IGNORE + CHAT ----------
B.send('IGNORE_ADD', { playerId: pa.playerId });
await sleep(200);
A.inbox.length = 0; B.inbox.length = 0;
A.send('SEND_CHAT', { message: 'oi beta, me ve?' });
const chatA = await A.waitFor((p) => p.op === 'SEND_CHAT');
ok('chat proprio volta', chatA.data.message.includes('me ve'));
const chatB = await B.until((p) => p.op === 'SEND_CHAT', 1500);
ok('chat de ignorado oculto', chatB === null);

B.send('IGNORE_REMOVE', { playerId: pa.playerId });
await sleep(200);
B.inbox.length = 0;
A.send('SEND_CHAT', { message: 'agora sim' });
const chatB2 = await B.waitFor((p) => p.op === 'SEND_CHAT', 3000);
ok('chat volta apos unignore', !!chatB2);

// ---------- MODERACAO ----------
B.inbox.length = 0;
A.send('SEND_CHAT', { message: 'isso e um fucking teste' });
const filtErr = await A.waitFor((p) => p.op === 'ERROR' && p.data.code === 'CHAT_FILTERED');
ok('chat filtrado', filtErr.data.code === 'CHAT_FILTERED');
const leaked = await B.until((p) => p.op === 'SEND_CHAT', 1000);
ok('msg filtrada nao broadcast', leaked === null);
// leetspeak
A.send('SEND_CHAT', { message: 'vai tomar no c4r4lh0' });
const filt2 = await A.waitFor((p) => p.op === 'ERROR' && p.data.code === 'CHAT_FILTERED', 3000);
ok('leet filtrado', !!filt2);
// rate limit: 5 ok / 6a erro (janela 10s — msgs anteriores contam; mandamos 7 limpas)
let rlErr = null;
for (let i = 0; i < 8; i++) {
    A.send('SEND_CHAT', { message: `spam${i}` });
    const e = await A.until((p) => p.op === 'ERROR' && p.data.code === 'CHAT_RATE_LIMITED', 400);
    if (e) { rlErr = e; break; }
}
ok('rate limit chat', !!rlErr);
// rename filtrado
A.send('RENAME_PLAYER', { username: 'fdp_rules' });
const rnErr = await A.waitFor((p) => p.op === 'ERROR' && p.data.code === 'NAME_FILTERED', 3000);
ok('rename filtrado', !!rnErr);
A.send('RENAME_PLAYER', { username: 'ProbeAlpha2' });
const rnOk = await A.waitFor((p) => p.op === 'PLAYER_DATA' && p.data.username === 'ProbeAlpha2', 3000);
ok('rename ok', rnOk.data.username === 'ProbeAlpha2');

// ---------- PETS ----------
A.send('GET_SOCIAL', {});
const socPets = await A.until((p) => p.op === 'SOCIAL_UPDATE' && p.data.petSpecies?.length > 0);
ok('catalogo de pets', (socPets?.data?.petSpecies || []).length >= 10);
const coinsBefore = pa.coins;
A.send('PET_ADOPT', { species: 'lounge_lizard', name: 'Scaly' });
const socPet1 = await A.until((p) => p.op === 'SOCIAL_UPDATE' && p.data.pets?.length === 1, 4000);
ok('pet adotado', !!socPet1);
const pdAfter = await A.until((p) => p.op === 'PLAYER_DATA' && p.data.coins === coinsBefore - 750, 4000);
ok('coins descontadas', !!pdAfter, `antes=${coinsBefore}`);
const pet = socPet1?.data?.pets?.[0];
A.send('PET_CARE', { petRowId: pet.petRowId, action: 'feed' });
const socPet2 = await A.until((p) => p.op === 'SOCIAL_UPDATE' && p.data.pets?.[0]?.hunger === 100, 3000);
ok('pet cuidado', !!socPet2);
A.send('PET_ADOPT', { species: 'inexistente' });
const badSp = await A.waitFor((p) => p.op === 'ERROR' && p.data.code === 'UNKNOWN_SPECIES', 3000);
ok('especie invalida rejeitada', !!badSp);
A.send('PET_RELEASE', { petRowId: pet.petRowId });
const socPet3 = await A.until((p) => p.op === 'SOCIAL_UPDATE' && p.data.pets?.length === 0, 3000);
ok('pet solto', !!socPet3);

// ---------- resumo ----------
const fails = results.filter(([, c]) => !c);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
if (fails.length) process.exitCode = 1;
A.ws.close(); B.ws.close();
setTimeout(() => process.exit(process.exitCode || 0), 300);
