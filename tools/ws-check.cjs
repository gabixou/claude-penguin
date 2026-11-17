const { createRequire } = require('module');
const req = createRequire('E:/project/club-penguin-browser/server/package.json');
const WS = req('ws');
const w = new WS('ws://localhost:8080');
w.on('open', () => w.send(JSON.stringify({ op: 'AUTH_GUEST', data: { sessionToken: null, forceGuest: true } })));
w.on('message', (d) => {
  const p = JSON.parse(d);
  if (p.op === 'PLAYER_DATA') { console.log('WS OK player=' + p.data.username); process.exit(0); }
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 8000);
