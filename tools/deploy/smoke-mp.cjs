// Smoke test multiplayer: 2 clientes WS -> AUTH_GUEST -> JOIN_ROOM -> se veem?
// Uso: node smoke-mp.cjs wss://HOST/ws
const { createRequire } = require('module');
const path = require('path');
// ws esta em server/node_modules — resolve a partir de la
const req = createRequire(path.join(__dirname, '..', '..', 'server', 'package.json'));
const WebSocket = req('ws');
const url = process.argv[2];
if (!url) { console.log('uso: node smoke-mp.cjs wss://HOST/ws'); process.exit(1); }

function client(name) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const seen = { joined: null, roomState: null, otherJoined: null };
        const t = setTimeout(() => reject(new Error(name + ' timeout')), 20000);
        ws.on('open', () => ws.send(JSON.stringify({ op: 'AUTH_GUEST', data: {} })));
        ws.on('message', (raw) => {
            let m; try { m = JSON.parse(raw); } catch { return; }
            if (process.env.DEBUG_OPS) console.log(`  [${name}] op=${m.op}`);
            if (m.op === 'ERROR') console.log(`  [${name}] ERROR:`, JSON.stringify(m.data));
            if (m.op === 'PLAYER_DATA' && !seen.joined) {
                seen.joined = m.data?.username || m.data?.player?.username || 'ok';
                ws.send(JSON.stringify({ op: 'JOIN_ROOM', data: { roomId: 'town', x: 300 + Math.random() * 100, y: 300 } }));
            }
            if (m.op === 'ROOM_STATE') seen.roomState = (m.data?.players || []).length;
            if (m.op === 'PLAYER_JOINED') seen.otherJoined = m.data?.username || 'alguem';
            // quando os dois já estão na sala, reporta
            if (seen.joined && seen.roomState !== null && seen.otherJoined) {
                clearTimeout(t);
                console.log(`[${name}] player=${seen.joined} roomPlayers=${seen.roomState} viuJoin=${seen.otherJoined}`);
                resolve({ ws, seen });
            }
        });
        ws.on('error', (e) => { console.log(`  [${name}] ws error:`, e.message); clearTimeout(t); reject(new Error(name + ': ' + e.message)); });
        ws.on('close', (c) => console.log(`  [${name}] closed`, c));
    });
}

(async () => {
    // conecta os dois "ao mesmo tempo" para o segundo ver o primeiro entrar
    const p1 = client('A');
    await new Promise(r => setTimeout(r, 800));
    const p2 = client('B');
    const [a, b] = await Promise.all([p1, p2]);
    // dar tempo do broadcast reverso chegar
    await new Promise(r => setTimeout(r, 1500));
    const msgsB = [];
    b.ws.on('message', (raw) => { try { const m = JSON.parse(raw); if (m.op === 'PLAYER_JOINED') msgsB.push(m.data?.username); } catch {} });
    console.log('RESUMO:', JSON.stringify({ a: a.seen, b: b.seen }));
    const ok = a.seen.roomState >= 1 && b.seen.roomState >= 1;
    console.log(ok ? 'SMOKE MP: PASS' : 'SMOKE MP: VERIFICAR');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FALHOU:', e.message); process.exit(1); });
