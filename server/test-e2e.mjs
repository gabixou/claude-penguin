// test-e2e.mjs — smoke test do protocolo contra ws://localhost:8090
// Uso: node test-e2e.mjs   (requer servidor com PENGUIN_DB temporario)
import WebSocket from 'ws';

const URL = process.env.SMOKE_WS_URL || 'ws://localhost:8090';
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
    // marca = posição da inbox no último send(); respostas procuradas só
    // depois dela (evita reencontrar mensagens de passos anteriores)
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

const ws1 = await connect();
const c1 = makeClient(ws1);

console.log('== auth/guest auto-create ==');
// forceGuest: sem isso, conexões de loopback herdam o pinguim Arenovisk
c1.send('AUTH_GUEST', { forceGuest: true });
const pd1 = await c1.waitOp('PLAYER_DATA');
check('PLAYER_DATA recebido (auto-cripto)', !!pd1.data?.playerId);
check('nome automatico Penguin_XXXX', /^Penguin_/.test(pd1.data?.username || ''), pd1.data?.username);
check('coins = 1000 + daily bonus 500', pd1.data?.coins === 1500, `coins=${pd1.data?.coins}`);
check('dailyBonus informado na criacao', pd1.data?.dailyBonus === 500, `dailyBonus=${pd1.data?.dailyBonus}`);
check('cor inicial no inventario', pd1.data?.inventory?.some(i => i.itemId === 1), JSON.stringify(pd1.data?.inventory));
check('canRename = true', pd1.data?.canRename === true);
const playerId = pd1.data.playerId;
const sessionToken = pd1.data.sessionToken;
check('sessionToken emitido', typeof sessionToken === 'string' && sessionToken.length > 10);

console.log('== compra (preco autoritativo) ==');
// item 102 custa 10 no catalogo — cliente manda cost=1 de proposito
c1.send('BUY_ITEM', { itemId: 102, cost: 1 });
const pdBuy = await c1.waitOp('PLAYER_DATA');
const bought = await c1.waitOp('ITEM_BOUGHT');
check('coins descontou preco do catalogo (10)', pdBuy.data?.coins === 1490, `coins=${pdBuy.data?.coins}`);
check('ITEM_BOUGHT com nome', bought.data?.name === 'Dark Vision Goggles', JSON.stringify(bought.data));
check('item 102 no inventario', pdBuy.data?.inventory?.some(i => i.itemId === 102));

c1.send('BUY_ITEM', { itemId: 102 });
const dup = await c1.waitOp('ERROR');
check(' recompra rejeitada (ALREADY_OWNED)', dup.data?.code === 'ALREADY_OWNED', dup.data?.code);

c1.send('BUY_ITEM', { itemId: 999999 });
const unk = await c1.waitOp('ERROR');
check('item inexistente rejeitado', unk.data?.code === 'UNKNOWN_ITEM', unk.data?.code);

console.log('== sala/equip/color ==');
c1.send('JOIN_ROOM', { roomId: 'town', x: 100, y: 100 });
await c1.waitOp('ROOM_STATE');

c1.send('EQUIP_ITEM', { slot: 'face', itemId: 102 });
await new Promise(r => setTimeout(r, 300));
c1.send('LOAD_PLAYER', {});
const pdEquip = await c1.waitOp('PLAYER_DATA');
check('equip persiste (face=102)', pdEquip.data?.equipped?.face === 102, JSON.stringify(pdEquip.data?.equipped));

c1.send('EQUIP_ITEM', { slot: 'head', itemId: 103 }); // nao possui
const eqFail = await c1.waitOp('ERROR');
check('equip item nao possuido falha', eqFail.data?.code === 'EQUIP_FAILED', eqFail.data?.code);

c1.send('SET_COLOR', { colorItemId: 5 }); // Red custa 20, nao possui
const colFail = await c1.waitOp('ERROR');
check('cor paga sem posse rejeitada', colFail.data?.code === 'ITEM_NOT_OWNED', colFail.data?.code);

c1.send('SET_COLOR', { colorItemId: 14 }); // Sensei Gray cost 0
await new Promise(r => setTimeout(r, 300));
c1.send('LOAD_PLAYER', {});
const pdColor = await c1.waitOp('PLAYER_DATA');
check('cor gratuita permitida (14)', pdColor.data?.colorItemId === 14, `colorItemId=${pdColor.data?.colorItemId}`);

console.log('== rename (uma vez) ==');
c1.send('RENAME_PLAYER', { username: 'RenamedPenguin' });
const pdRen = await c1.waitOp('PLAYER_DATA');
check('rename ok', pdRen.data?.username === 'RenamedPenguin', pdRen.data?.username);
check('canRename agora false', pdRen.data?.canRename === false);

// chat deve usar o nome novo (sessao da sala sincronizada)
c1.send('SEND_CHAT', { message: 'ola' });
await new Promise(r => setTimeout(r, 300));
const chatMsg = c1.inbox.filter(p => p.op === 'SEND_CHAT').pop();
check('chat usa nome novo', chatMsg?.data?.username === 'RenamedPenguin', chatMsg?.data?.username);

c1.send('RENAME_PLAYER', { username: 'OutraVez' });
const ren2 = await c1.waitOp('ERROR');
check('segunda troca rejeitada', ren2.data?.code === 'RENAME_FAILED', ren2.data?.code);

c1.send('RENAME_PLAYER', { username: 'NomeLivre123' }); // nome livre
const ren3 = await c1.waitOp('ERROR');
check('rename bloqueado mesmo com nome livre', ren3.data?.code === 'RENAME_FAILED');

console.log('== persistencia/reconexao ==');
ws1.close();
await new Promise(r => setTimeout(r, 300));

const ws2 = await connect();
const c2 = makeClient(ws2);
c2.send('AUTH_GUEST', { sessionToken, forceGuest: true });
const pdRelog = await c2.waitOp('PLAYER_DATA');
check('mesmo playerId via token', pdRelog.data?.playerId === playerId);
check('dailyBonus NAO repete no mesmo dia', !pdRelog.data?.dailyBonus, `dailyBonus=${pdRelog.data?.dailyBonus}`);
check('coins persistem (sem novo bonus)', pdRelog.data?.coins === 1490, `coins=${pdRelog.data?.coins}`);
check('username persistido', pdRelog.data?.username === 'RenamedPenguin');
check('equip persistido', pdRelog.data?.equipped?.face === 102);
check('cor persistida', pdRelog.data?.colorItemId === 14);
check('canRename continua false', pdRelog.data?.canRename === false);

ws2.close();
console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
