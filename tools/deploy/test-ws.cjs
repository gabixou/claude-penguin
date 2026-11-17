const WebSocket = require('ws');
const url = process.argv[2] || 'wss://sophisticated-des-beans-kelkoo.trycloudflare.com/ws';
const ws = new WebSocket(url);
const t = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
ws.on('open', () => { console.log('WS OPEN ok'); });
ws.on('message', (d) => { console.log('MSG:', d.toString().slice(0, 300)); clearTimeout(t); ws.close(); setTimeout(() => process.exit(0), 300); });
ws.on('error', (e) => { console.log('WS ERR', e.message); clearTimeout(t); process.exit(1); });
ws.on('close', (c, r) => { console.log('CLOSE', c, r.toString()); clearTimeout(t); process.exit(0); });
setTimeout(() => { if (ws.readyState === 1) { console.log('OPEN (sem msg do server, ok)'); clearTimeout(t); process.exit(0); } }, 5000);
