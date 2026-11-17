import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.changeRoom('pet'));
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('roundup'));
await p.waitForFunction(() => !!document.querySelector('iframe[src*="pufflescape"]'), null, { timeout: 20000 });
// espera o boot do jogo chegar no LevelSelect (intro ~ alguns segundos)
await p.waitForTimeout(14000);
// posicao do X original: close1_png em (1480,39) num stage 1520x960
const rect = await p.evaluate(() => {
  const f = document.querySelector('iframe[src*="pufflescape"]');
  const r = f.getBoundingClientRect();
  return { l: r.left, t: r.top, w: r.width, h: r.height };
});
const sx = rect.l + (1480 / 1520) * rect.w;
const sy = rect.t + (48 / 960) * rect.h;
console.log('X click at', sx, sy, 'iframe rect', JSON.stringify(rect));
await p.mouse.click(sx, sy);
await p.waitForTimeout(1500);
const st = await p.evaluate(() => ({
  overlay: !!document.querySelector('iframe[src*="pufflescape"]'),
  room: window.__penguin.scene.currentRoom,
}));
console.log('STATE:', JSON.stringify(st), 'ERRS:', JSON.stringify(errs.slice(0,3)));
await p.screenshot({ path: 'shots/puffle-exit.png' });
await b.close();
