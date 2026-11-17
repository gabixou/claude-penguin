const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({ op: 'JOIN_ROOM', data: { playerId: 'test1', roomId: 'town', x: 100, y: 100, paperdoll: { head: 402, feet: 351 } } }));
});
ws.on('message', (d) => {
  const p = JSON.parse(d);
  console.log('recv', p.op, JSON.stringify(p.data).slice(0, 300));
  if (p.op === 'ROOM_STATE') {
    ws.send(JSON.stringify({ op: 'EQUIP_ITEM', data: { playerId: 'test1', slot: 'body', itemId: 201 } }));
    ws.send(JSON.stringify({ op: 'SET_COLOR', data: { playerId: 'test1', color: 0xff0000 } }));
    setTimeout(() => process.exit(0), 1500);
  }
});
setTimeout(() => process.exit(1), 8000);
