// test-accounts.mjs — fluxo de contas: register/login/recover/set_password/logout
// Uso: node test-accounts.mjs  (requer servidor ws://localhost:8090 + PENGUIN_DB temp)
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
    };
}

const USER = `TestUser${Date.now().toString(36).toUpperCase()}`;
const PASS = 'senha-segura-123';

console.log('== NEED_AUTH sem token e sem guest ==');
{
    const ws = await connect();
    const c = makeClient(ws);
    // sessionToken bogus impede o Arenovisk (loopback) e cai no NEED_AUTH
    c.send('AUTH_GUEST', { sessionToken: 'bogus-token' });
    const na = await c.waitOp('NEED_AUTH');
    check('servidor pede auth', na.op === 'NEED_AUTH');
    ws.close();
}

console.log('== REGISTER ==');
let token, recoveryCode, playerId;
{
    const ws = await connect();
    const c = makeClient(ws);
    c.send('REGISTER', { username: USER, password: PASS });
    const pd = await c.waitOp('PLAYER_DATA');
    const info = await c.waitOp('ACCOUNT_INFO');
    check('PLAYER_DATA com hasPassword', pd.data?.hasPassword === true, JSON.stringify(pd.data && { hasPassword: pd.data.hasPassword }));
    check('needsPasswordSetup false', pd.data?.needsPasswordSetup === false);
    check('recoveryCode no formato XXXX-XXXX-XXXX', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(info.data?.recoveryCode || ''), info.data?.recoveryCode);
    check('recoveryLabel com nome', (info.data?.recoveryLabel || '').includes(USER));
    token = pd.data.sessionToken;
    playerId = pd.data.playerId;
    recoveryCode = info.data.recoveryCode;
    ws.close();
}

console.log('== REGISTER duplicado / regras de nome ==');
{
    const ws = await connect();
    const c = makeClient(ws);
    c.send('REGISTER', { username: USER.toLowerCase(), password: PASS }); // case-insensitive
    const dup = await c.waitOp('ERROR');
    check('username duplicado (case-insensitive) rejeitado', dup.data?.code === 'USERNAME_TAKEN', dup.data?.code);

    c.send('REGISTER', { username: 'admin', password: PASS });
    const blk = await c.waitOp('ERROR');
    check('nome bloqueado rejeitado', blk.data?.code === 'INVALID_USERNAME', blk.data?.code);

    c.send('REGISTER', { username: 'ab', password: PASS });
    const short = await c.waitOp('ERROR');
    check('nome curto rejeitado', short.data?.code === 'INVALID_USERNAME', short.data?.code);

    c.send('REGISTER', { username: 'SenhaFraca1', password: '123' });
    const weak = await c.waitOp('ERROR');
    check('senha fraca rejeitada', weak.data?.code === 'INVALID_PASSWORD', weak.data?.code);
    ws.close();
}

console.log('== LOGIN ==');
{
    const ws = await connect();
    const c = makeClient(ws);
    c.send('LOGIN', { username: USER, password: 'errada' });
    const bad = await c.waitOp('ERROR');
    check('senha errada rejeitada', bad.data?.code === 'INVALID_CREDENTIALS', bad.data?.code);

    c.send('LOGIN', { username: USER, password: PASS });
    const pd = await c.waitOp('PLAYER_DATA');
    check('login ok mesmo playerId', pd.data?.playerId === playerId);
    check('sem ACCOUNT_INFO no login', !c.inbox.some((p) => p.op === 'ACCOUNT_INFO'));
    ws.close();
}

console.log('== sessão persiste e LOGOUT revoga ==');
{
    const ws = await connect();
    const c = makeClient(ws);
    c.send('AUTH_GUEST', { sessionToken: token });
    const pd = await c.waitOp('PLAYER_DATA');
    check('token de conta resolve via AUTH_GUEST', pd.data?.playerId === playerId);

    c.send('LOGOUT', {});
    const out = await c.waitOp('LOGGED_OUT');
    check('LOGGED_OUT recebido', out.op === 'LOGGED_OUT');
    ws.close();

    const ws2 = await connect();
    const c2 = makeClient(ws2);
    c2.send('AUTH_GUEST', { sessionToken: token });
    const na = await c2.waitOp('NEED_AUTH');
    check('token revogado não autentica', na.op === 'NEED_AUTH');
    ws2.close();
}

console.log('== RECOVER ==');
{
    const ws = await connect();
    const c = makeClient(ws);
    c.send('RECOVER', { username: USER, code: 'XXXX-XXXX-XXXX', newPassword: 'nova-senha-456' });
    const bad = await c.waitOp('ERROR');
    check('código errado rejeitado', bad.data?.code === 'INVALID_RECOVERY', bad.data?.code);

    c.send('RECOVER', { username: USER, code: recoveryCode, newPassword: 'nova-senha-456' });
    const ok = await c.waitOp('RECOVERY_OK');
    check('RECOVERY_OK com novo código', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(ok.data?.recoveryCode || ''), ok.data?.recoveryCode);
    check('novo código diferente do antigo', ok.data?.recoveryCode !== recoveryCode);
    recoveryCode = ok.data.recoveryCode;
    ws.close();

    // senha antiga não serve mais; nova sim
    const ws2 = await connect();
    const c2 = makeClient(ws2);
    c2.send('LOGIN', { username: USER, password: PASS });
    const old = await c2.waitOp('ERROR');
    check('senha antiga rejeitada após recover', old.data?.code === 'INVALID_CREDENTIALS', old.data?.code);

    c2.send('LOGIN', { username: USER, password: 'nova-senha-456' });
    const pd = await c2.waitOp('PLAYER_DATA');
    check('login com senha nova ok', pd.data?.playerId === playerId);
    ws2.close();
}

console.log('== guest sem senha + CLAIM/SET_PASSWORD ==');
let guestToken, guestName;
{
    const ws = await connect();
    const c = makeClient(ws);
    c.send('AUTH_GUEST', { guest: true });
    const pd = await c.waitOp('PLAYER_DATA');
    guestToken = pd.data.sessionToken;
    guestName = pd.data.username;
    check('guest criado sem senha', pd.data?.hasPassword === false && pd.data?.needsPasswordSetup === true);

    // CLAIM pelo nome define sessão para SET_PASSWORD
    const ws2 = await connect();
    const c2 = makeClient(ws2);
    c2.send('CLAIM_ACCOUNT', { username: guestName });
    const pd2 = await c2.waitOp('PLAYER_DATA');
    check('CLAIM_ACCOUNT retorna o mesmo player', pd2.data?.playerId === pd.data.playerId);

    c2.send('SET_PASSWORD', { password: 'guest-pass-1' });
    const pd3 = await c2.waitOp('PLAYER_DATA');
    const info = await c2.waitOp('ACCOUNT_INFO');
    check('SET_PASSWORD marca hasPassword', pd3.data?.hasPassword === true);
    check('ACCOUNT_INFO com recovery code', !!info.data?.recoveryCode);
    ws2.close();
    ws.close();
}

console.log(failures === 0 ? '\nTODOS OS TESTES DE CONTAS PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
