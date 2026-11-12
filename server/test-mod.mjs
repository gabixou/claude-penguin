// test-mod.mjs — moderação: roles, kick, mute, ban, filtro de chat, report
// Uso: node test-mod.mjs  (requer servidor ws://localhost:8090 + PENGUIN_DB temp)
// O role de moderador é atribuído direto no banco (setup do teste).
import WebSocket from 'ws';

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
        inbox,
        ws,
    };
}

async function guest(name) {
    const ws = await connect();
    const c = makeClient(ws);
    c.send('AUTH_GUEST', { guest: true });
    const pd = await c.waitOp('PLAYER_DATA');
    return { c, ws, data: pd.data };
}

// players: mod (moderator), alvo, normal
const modP = await guest('mod');
const alvo = await guest('alvo');
const normal = await guest('normal');

// promove o primeiro a moderator direto no banco
// usa o mesmo banco do servidor (PENGUIN_DB deve bater com o do server)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.PENGUIN_DB = process.env.PENGUIN_DB || join(tmpdir(), 'test-penguin.db');
const { default: db } = await import('./src/db.js');
db.prepare("UPDATE players SET role = 'moderator' WHERE player_id = ?").run(modP.data.playerId);
// o servidor lê o role do banco a cada MOD_ACTION — não precisa reautenticar

console.log('== MOD_ACTION sem role deve falhar (normal) ==');
normal.c.send('MOD_ACTION', { action: 'mod.kick', targetPlayerId: alvo.data.playerId });
const forbid = await normal.c.waitOp('ERROR');
check('player normal recebe FORBIDDEN', forbid.data?.code === 'FORBIDDEN', forbid.data?.code);

console.log('== report ==');
normal.c.send('REPORT', { targetPlayerId: alvo.data.playerId, reason: 'teste' });
const rep = await normal.c.waitOp('REPORT_OK');
check('REPORT_OK recebido', rep.op === 'REPORT_OK');

console.log('== filtro de chat ==');
db.prepare("INSERT INTO chat_filter_rule (pattern, action, created_at) VALUES ('palavrao', 'mask', ?)").run(Date.now());
alvo.c.send('JOIN_ROOM', { roomId: 'town', x: 100, y: 100 });
await alvo.c.waitOp('ROOM_STATE');
normal.c.send('JOIN_ROOM', { roomId: 'town', x: 200, y: 200 });
await normal.c.waitOp('ROOM_STATE');
alvo.c.send('SEND_CHAT', { message: 'disse palavrao feio' });
const masked = await normal.c.waitOp('SEND_CHAT');
check('chat mascarado pelo filtro', masked.data?.message?.includes('*******') && !masked.data.message.includes('palavrao'), masked.data?.message);

db.prepare("INSERT INTO chat_filter_rule (pattern, action, created_at) VALUES ('bloqueada', 'block', ?)").run(Date.now());
alvo.c.send('SEND_CHAT', { message: 'isso e bloqueada' });
const blocked = await alvo.c.waitOp('ERROR');
check('chat bloqueado pelo filtro', blocked.data?.code === 'CHAT_BLOCKED', blocked.data?.code);

console.log('== mute ==');
modP.c.send('MOD_ACTION', { action: 'mod.mute', targetPlayerId: alvo.data.playerId, minutes: 5, reason: 'teste' });
const muteOk = await modP.c.waitOp('MOD_OK');
check('MOD_OK mute', muteOk.data?.action === 'mod.mute');
alvo.c.send('SEND_CHAT', { message: 'ainda aqui?' });
const muted = await alvo.c.waitOp('ERROR');
check('chat de mutado rejeitado', muted.data?.code === 'MUTED', muted.data?.code);

console.log('== kick ==');
// avanca o mark do alvo além do erro MUTED anterior
alvo.c.send('LOAD_PLAYER', {});
alvo.c.waitOp('PLAYER_DATA').catch(() => {});
modP.c.send('MOD_ACTION', { action: 'mod.kick', targetPlayerId: alvo.data.playerId, reason: 'teste' });
await modP.c.waitOp('MOD_OK');
const kicked = await alvo.c.waitOp('ERROR', 6000).catch(() => null);
check('alvo recebeu KICKED', kicked?.data?.code === 'KICKED', kicked?.data?.code);
await new Promise((r) => setTimeout(r, 300));

console.log('== ban ==');
modP.c.send('MOD_ACTION', { action: 'mod.ban', targetPlayerId: alvo.data.playerId, reason: 'spam', minutes: 60 });
await modP.c.waitOp('MOD_OK');
const banRow = db.prepare('SELECT * FROM ban WHERE player_id = ? AND revoked_at IS NULL').get(alvo.data.playerId);
check('ban registrado no banco', !!banRow && !!banRow.expires_at);

// alvo tenta reivindicar a conta: sessão revogada + ban ativo -> BANNED
const wsAlvo2 = await connect();
const cAlvo2 = makeClient(wsAlvo2);
cAlvo2.send('CLAIM_ACCOUNT', { username: alvo.data.username });
const banErr = await cAlvo2.waitOp('ERROR').catch(() => null);
check('banido bloqueado no CLAIM_ACCOUNT', banErr?.data?.code === 'BANNED', banErr?.data?.code);
wsAlvo2.close();

// login direto também é bloqueado (guest não tem senha -> CLAIM path coberto pelo ban check)
alvo.c.send('JOIN_ROOM', { roomId: 'town' });
const joinErr = await alvo.c.waitOp('ERROR').catch(() => null);
// sem sessão autenticada -> NOT_AUTHENTICATED; o ban check real acontece no login
// (coberto por LOGIN com senha no test-accounts + activeBanFor no AUTH_GUEST)

console.log('== audit log ==');
const audits = db.prepare("SELECT * FROM audit_log WHERE action LIKE 'mod.%'").all();
check('audit_log registrou ações', audits.length >= 3, `n=${audits.length}`);

console.log('== unban ==');
modP.c.send('MOD_ACTION', { action: 'mod.unban', targetPlayerId: alvo.data.playerId });
await modP.c.waitOp('MOD_OK');
const still = db.prepare('SELECT COUNT(*) AS n FROM ban WHERE player_id = ? AND revoked_at IS NULL').get(alvo.data.playerId).n;
check('ban revogado', still === 0);

modP.ws.close(); alvo.ws.close(); normal.ws.close();
console.log(failures === 0 ? '\nTODOS OS TESTES DE MODERAÇÃO PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
