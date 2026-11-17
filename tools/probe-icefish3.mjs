import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
let errs = 0;
p.on('pageerror', e => { errs++; console.log('PAGE ERR:', e.message); });
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);
await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent === 'PLAY')?.click());

// joga 30s: move mouse aleatoriamente + cliques para pegar peixe
for (let i = 0; i < 15; i++) {
  await p.mouse.move(760, 200 + Math.random() * 500);
  await p.waitForTimeout(1200);
  if (i % 3 === 0) await p.mouse.down().then(() => p.mouse.up());
}
const st = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  if (!g?.model) return null;
  const m = g.model;
  return {
    running: m.running, over: m.over, won: m.won,
    caught: m.fishCaught, orange: m.orangeFish, lives: m.lives,
    level: m.level, jelly: m.jellyHits, lineCuts: m.lineCuts,
    hookFrame: g._frame('hook'), ticks: m.ticks,
    fishActive: [1,2,3,4,5,6,7,8].filter(i => g._frame('fish'+i) > 1).length,
  };
});
console.log('apos ~30s:', JSON.stringify(st), 'erros:', errs);
// sai pelo EXIT -> reward
const coins = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  return g ? g._coins() : null;
});
console.log('coins calculadas:', coins);
await p.screenshot({ path: 'tools/shots/icefish-gameplay.png' });
await b.close();
