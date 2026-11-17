import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 160)));
const t0 = Date.now();
await p.goto('https://gopenguin.lol/', { waitUntil: 'domcontentloaded', timeout: 60000 });
// espera fixa para o jogo carregar (login guest pode ser necessario)
await p.waitForTimeout(20000);
const nav = await p.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0] || {};
  return {
    domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
    loadEvent: Math.round(n.loadEventEnd || 0),
    transferSize: n.transferSize, encodedBodySize: n.encodedBodySize,
    domInteractive: Math.round(n.domInteractive || 0),
  };
});
console.log('NAV', JSON.stringify(nav), 'elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const st = await p.evaluate(() => ({
  url: location.href,
  title: document.title,
  canvases: document.querySelectorAll('canvas').length,
  imgs: document.querySelectorAll('img').length,
  bodyText: document.body?.innerText?.slice(0, 300),
}));
console.log('STATE', JSON.stringify(st));
const res = await p.evaluate(() => {
  const es = performance.getEntriesByType('resource');
  const rows = es.map(e => ({
    name: e.name.replace(location.origin, ''),
    type: e.initiatorType,
    dur: Math.round(e.duration),
    start: Math.round(e.startTime),
    transfer: e.transferSize, encoded: e.encodedBodySize, decoded: e.decodedBodySize,
  }));
  rows.sort((a, b) => b.transfer - a.transfer);
  return {
    count: rows.length,
    totalTransfer: rows.reduce((s, r) => s + r.transfer, 0),
    totalDecoded: rows.reduce((s, r) => s + r.decoded, 0),
    top: rows.slice(0, 50),
    byType: rows.reduce((m, r) => { m[r.type] = (m[r.type] || 0) + 1; return m; }, {}),
  };
});
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('RESOURCE COUNT', res.count, 'TOTAL_TRANSFER', (res.totalTransfer / 1048576).toFixed(2) + 'MB', 'TOTAL_DECODED', (res.totalDecoded / 1048576).toFixed(2) + 'MB');
console.log('BY_TYPE', JSON.stringify(res.byType));
console.log('--- TOP BY BYTES ---');
for (const r of res.top) console.log(kb(r.transfer).padStart(9), 'enc=' + kb(r.encoded).padStart(8), 'dec=' + kb(r.decoded).padStart(9), 'dur=' + String(r.dur).padStart(6), 'start=' + String(r.start).padStart(6), r.type.padEnd(9), r.name.slice(0, 110));
await b.close();
