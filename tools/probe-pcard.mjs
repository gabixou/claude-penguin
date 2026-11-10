import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
// espera movie + pinguim renderizado
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin;
    const sc = window.__penguin?.scene;
    return !!(sc && sc._movieReady && sc.localPlayer && sc.localPlayer.view);
  }).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
// posicao do pinguim em coords de tela
const pos = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const lp = sc.localPlayer;
  const b = lp._lib.bounds;
  const wx = lp.x + (b.x0 + b.x1) / 2, wy = lp.y + (b.y0 + b.y1) / 2;
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { wx, wy, left: c.left, top: c.top, w: c.width, h: c.height };
});
console.log('penguin world', pos.wx.toFixed(0), pos.wy.toFixed(0));
const sx = pos.left + (pos.wx / 760) * pos.w, sy = pos.top + (pos.wy / 480) * pos.h;
console.log('click em', sx.toFixed(0), sy.toFixed(0));
await p.mouse.click(sx, sy);
await p.waitForTimeout(6000); // interface movie load + render
const st = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  return { open: sc.playerCard?.isOpen, list: sc.input.hitTestPointer ? 'ok' : '?' };
});
console.log('card:', JSON.stringify(st));
await p.screenshot({ path: 'shots/pc-test.png' });
await b.close();
