import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => ws.send(JSON.stringify({ op: 'LOGIN_PLAYER', data: { username: 'Arenovisk' } })));
ws.on('message', (m) => {
  const p = JSON.parse(m);
  if (p.op === 'PLAYER_DATA') {
    console.log('user:', p.data.username, '| coins:', p.data.coins, '| inv:', p.data.inventory?.length, '| allItems:', p.data.allItems, '| color:', p.data.colorItemId);
    ws.close(); process.exit(0);
  }
  if (p.op === 'ERROR') { console.log('ERR', p.data); process.exit(1); }
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 8000);
