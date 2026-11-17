import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
for (let i = 0; i < 60; i++) {
  const open = await p.evaluate(() => !!window.__penguin.scene.playerCard?.container).catch(() => false);
  if (open) break;
  await p.waitForTimeout(1000);
}
// zona close = a de y menor (topo). pega posicao de tela real
const pos = await p.evaluate(() => {
  const cont = window.__penguin.scene.playerCard.container;
  const zones = cont.list.filter(o => o.type === 'Zone');
  const z = zones.reduce((a, b2) => (b2.y < a.y ? b2 : a));
  const m = z.getWorldTransformMatrix();
  const canvas = window.__penguin.scene.game.canvas.getBoundingClientRect();
  // world->screen: canvas CSS rect mapeia 760x480
  const sx = canvas.width / 760, sy = canvas.height / 480;
  return { wx: m.e, wy: m.f, sx, sy, left: canvas.left, top: canvas.top, cw: canvas.width, ch: canvas.height };
});
console.log('close zone', JSON.stringify(pos));
const cx = pos.left + pos.wx * (pos.cw / 760);
const cy = pos.top + pos.wy * (pos.ch / 480);
console.log('click at', cx, cy);
await p.mouse.click(cx, cy);
await p.waitForTimeout(1500);
const st = await p.evaluate(() => ({ open: !!window.__penguin.scene.playerCard?.container }));
console.log('after click:', JSON.stringify(st));
await b.close();
