import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(3000);

const opened = await p.evaluate(() => {
  const s = window.__penguin.scene;
  s._showGameUnavailable('fish');
  return !!document.querySelector('iframe[src*="icefishing"]');
});
console.log('overlay icefishing:', opened);
await p.waitForTimeout(3000);

// estado interno do jogo (canvas 2d — verifica entidades e variaveis)
const st = await p.evaluate(() => {
  const f = document.querySelector('iframe[src*="icefishing"]');
  const w = f.contentWindow;
  return {
    entities: Object.keys(w.Entities || {}).length,
    names: Object.values(w.Entities || {}).map(e => e.name).slice(0, 12),
    worms: w.worms, coins: w.coins, timeLeft: Math.round(w.timeLeft),
    canvas: !!f.contentDocument.querySelector('canvas'),
  };
});
console.log('game:', JSON.stringify(st));
await p.waitForTimeout(7000); // ~2-3 spawns
const st2 = await p.evaluate(() => {
  const w = document.querySelector('iframe[src*="icefishing"]').contentWindow;
  return { entities: Object.keys(w.Entities || {}).length, names: [...new Set(Object.values(w.Entities).map(e => e.name))] };
});
console.log('após 7s:', JSON.stringify(st2));
await p.screenshot({ path: 'tools/shots/icefishing-test.png' });
await b.close();
