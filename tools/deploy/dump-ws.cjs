const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.join(__dirname, '..', '..', 'server', 'package.json'));
const WebSocket = req('ws');
const url = process.argv[2];
const ws = new WebSocket(url);
ws.on('open', () => { console.log('OPEN'); ws.send(JSON.stringify({ op: 'AUTH_GUEST', data: {} })); });
ws.on('message', (raw) => {
    const s = raw.toString();
    console.log('FRAME', s.length, 'bytes:', s.slice(0, 150));
    try {
        const m = JSON.parse(s);
        if (m.op === 'PLAYER_DATA') {
            console.log('>>> PLAYER_DATA recebido, user=', m.data && m.data.username);
            ws.send(JSON.stringify({ op: 'JOIN_ROOM', data: { roomId: 'town', x: 350, y: 300 } }));
        }
        if (m.op === 'ROOM_STATE') console.log('>>> ROOM_STATE players=', (m.data.players || []).length);
        if (m.op === 'PLAYER_JOINED') console.log('>>> PLAYER_JOINED', m.data && m.data.username);
    } catch (e) { console.log('parse err', e.message); }
});
ws.on('error', (e) => console.log('ERR', e.message));
ws.on('close', (c, r) => { console.log('CLOSE', c); process.exit(0); });
setTimeout(() => { console.log('fim do teste'); process.exit(0); }, 12000);
