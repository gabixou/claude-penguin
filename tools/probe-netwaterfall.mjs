import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const room = process.argv[2] || 'town';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const t0 = Date.now();
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
const nav = await p.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0] || {};
  return {
    domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
    loadEvent: Math.round(n.loadEventEnd || 0),
    domInteractive: Math.round(n.domInteractive || 0),
    transferSize: n.transferSize, encodedBodySize: n.encodedBodySize,
  };
});
console.log('NAV', JSON.stringify(nav), 'movieReady', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await p.waitForTimeout(5000);
const res = await p.evaluate(() => {
  const es = performance.getEntriesByType('resource');
  const rows = es.map(e => ({
    name: e.name.replace('http://localhost:3000', ''),
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
    top: rows.slice(0, 40),
    slow: rows.filter(r => r.dur > 400).sort((a, b) => b.dur - a.dur).slice(0, 20),
    byType: rows.reduce((m, r) => { m[r.type] = (m[r.type] || 0) + 1; return m; }, {}),
  };
});
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('RESOURCE COUNT', res.count, 'TOTAL_TRANSFER', (res.totalTransfer / 1048576).toFixed(1) + 'MB', 'TOTAL_DECODED', (res.totalDecoded / 1048576).toFixed(1) + 'MB');
console.log('BY_TYPE', JSON.stringify(res.byType));
console.log('--- TOP BY BYTES ---');
for (const r of res.top) console.log(kb(r.transfer).padStart(8), 'dur=' + String(r.dur).padStart(5), 'start=' + String(r.start).padStart(6), r.type.padEnd(9), r.name.slice(0, 100));
console.log('--- SLOW >400ms ---');
for (const r of res.slow) console.log('dur=' + String(r.dur).padStart(5), kb(r.transfer).padStart(8), 'start=' + String(r.start).padStart(6), r.name.slice(0, 100));
await b.close();
