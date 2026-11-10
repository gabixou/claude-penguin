import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[pg]', m.type(), m.text().slice(0, 200)); });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => {
    const sc = window.__penguin?.scene;
    return !!(sc && sc._movieReady && sc.localPlayer && sc.localPlayer.view);
  }).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
const pos = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const lp = sc.localPlayer;
  const b = lp._lib.bounds;
  const wx = lp.x + (b.x0 + b.x1) / 2, wy = lp.y + (b.y0 + b.y1) / 2;
  const hit = sc._penguinAt(wx, wy);
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { wx, wy, hit: hit ? hit.playerId : null, bounds: b, lp: { x: lp.x, y: lp.y },
    left: c.left, top: c.top, w: c.width, h: c.height };
});
console.log(JSON.stringify(pos));
const sx = pos.left + (pos.wx / 760) * pos.w, sy = pos.top + (pos.wy / 480) * pos.h;
await p.mouse.click(sx, sy);
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(1000);
  const st = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    return { open: !!sc.playerCard?.isOpen, busy: !!sc.playerCard?.container };
  }).catch(() => null);
  if (st?.open) { console.log('OPEN em', i + 1, 's'); break; }
  if (i === 29) console.log('final:', JSON.stringify(st));
}
await p.screenshot({ path: 'shots/pc-test.png' });
await b.close();
