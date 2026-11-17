import { createRequire } from 'module';
const require = createRequire('E:/project/club-penguin-browser/server/package.json');
const WebSocket = require('ws');

const log = (who, msg) => console.log(`${who}: ${msg}`);

function client(name) {
  const ws = new WebSocket('ws://localhost:8080');
  const c = { ws, name, playerId: null, gotActions: [], roomState: null };
  ws.on('open', () => ws.send(JSON.stringify({ op: 'AUTH_GUEST', data: { sessionToken: null, forceGuest: true } })));
  ws.on('message', (raw) => {
    const p = JSON.parse(raw.toString());
    if (p.op === 'PLAYER_DATA') {
      c.playerId = p.data.playerId;
      ws.send(JSON.stringify({ op: 'JOIN_ROOM', data: { roomId: 'town', x: 400, y: 300 } }));
    } else if (p.op === 'PLAYER_ACTION') {
      c.gotActions.push(p.data.action);
      log(name, `recv PLAYER_ACTION ${p.data.action} from ${p.data.playerId}`);
    } else if (p.op === 'ROOM_STATE') {
      c.roomState = p.data.players.map(x => ({ u: x.username, a: x.action }));
      log(name, `ROOM_STATE ${JSON.stringify(c.roomState)}`);
    } else if (p.op === 'PLAYER_JOINED') {
      log(name, `PLAYER_JOINED ${p.data.username} action=${p.data.action}`);
    }
  });
  return c;
}

const a = client('A');
const b = client('B');
await new Promise(r => setTimeout(r, 2500));
// B danca -> A deve receber
b.ws.send(JSON.stringify({ op: 'PLAYER_ACTION', data: { action: 'dance' } }));
await new Promise(r => setTimeout(r, 800));
// B anda -> servidor limpa action; A recebe MOVE_PLAYER (nao logado)
b.ws.send(JSON.stringify({ op: 'MOVE_PLAYER', data: { targetX: 410, targetY: 310 } }));
await new Promise(r => setTimeout(r, 800));
// B senta
b.ws.send(JSON.stringify({ op: 'PLAYER_ACTION', data: { action: 'sit' } }));
await new Promise(r => setTimeout(r, 800));
// C entra -> ROOM_STATE deve mostrar B com action='sit'
const c2 = client('C');
await new Promise(r => setTimeout(r, 2500));
log('CHECK', `A recebeu actions: ${JSON.stringify(a.gotActions)} (esperado [dance, sit])`);
log('CHECK', `C roomState: ${JSON.stringify(c2.roomState)}`);
a.ws.close(); b.ws.close(); c2.ws.close();
process.exit(0);
