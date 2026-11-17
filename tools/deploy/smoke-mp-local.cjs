// Smoke test multiplayer LOCAL (rodar de dentro de server/ no VPS):
//   cd /opt/club-penguin/server && node smoke-mp-local.cjs
// 2 clientes -> AUTH_GUEST -> JOIN_ROOM town -> devem se ver.
const WebSocket = require('ws');
const url = process.argv[2] || 'ws://localhost:8080/ws';

function client(name, token) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const seen = { joined: null, roomState: null, otherJoined: null };
        const t = setTimeout(() => reject(new Error(name + ' timeout')), 20000);
        ws.on('open', () => ws.send(JSON.stringify({ op: 'AUTH_GUEST', data: token ? { sessionToken: token } : {} })));
        ws.on('message', (raw) => {
            let m; try { m = JSON.parse(raw); } catch { return; }
            if (m.op === 'PLAYER_DATA' && !seen.joined) {
                seen.joined = m.data?.username || 'ok';
                ws.send(JSON.stringify({ op: 'JOIN_ROOM', data: { roomId: 'town', x: 300 + Math.random() * 100, y: 300 } }));
            }
            if (m.op === 'ROOM_STATE') {
                seen.roomState = (m.data?.players || []).length;
                // B entra depois: valida pelo ROOM_STATE com 2+ players
                if (name === 'B' && seen.roomState >= 2 && !seen.otherJoined) {
                    seen.otherJoined = 'roomState>=2';
                }
            }
            if (m.op === 'PLAYER_JOINED') seen.otherJoined = m.data?.username || 'alguem';
            if (seen.joined && seen.roomState !== null && seen.otherJoined) {
                clearTimeout(t);
                console.log(`[${name}] player=${seen.joined} roomPlayers=${seen.roomState} viuJoin=${seen.otherJoined}`);
                resolve({ ws, seen });
            }
        });
        ws.on('error', (e) => { clearTimeout(t); reject(new Error(name + ': ' + e.message)); });
    });
}

(async () => {
    const p1 = client('A');
    await new Promise(r => setTimeout(r, 800));
    const p2 = client('B', 'tok_smoke_b_001');
    const [a, b] = await Promise.all([p1, p2]);
    console.log('RESUMO:', JSON.stringify({ a: a.seen, b: b.seen }));
    const ok = a.seen.roomState >= 1 && b.seen.roomState >= 1 && a.seen.otherJoined && b.seen.otherJoined;
    console.log(ok ? 'SMOKE MP: PASS' : 'SMOKE MP: VERIFICAR');
    process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FALHOU:', e.message); process.exit(1); });
