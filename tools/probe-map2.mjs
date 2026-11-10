import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.scene?.localPlayer?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.scene.toggleMap());
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(1000);
  const v = await p.evaluate(() => window.__penguin.scene.islandMap?.container?.visible).catch(() => false);
  if (v) break;
}
await p.screenshot({ path: 'shots/map-open.png' });
// clica no centro da zona do dock (indice 1)
const z = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const zs = sc.islandMap.container.list.filter((o) => o.type === 'Zone');
  const c = document.querySelector('canvas').getBoundingClientRect();
  const d = zs[1];
  return { x: d.x, y: d.y, left: c.left, top: c.top, w: c.width, h: c.height };
});
const sx = z.left + (z.x / 760) * z.w, sy = z.top + (z.y / 480) * z.h;
console.log('click zone em', sx.toFixed(0), sy.toFixed(0), '(world', z.x, z.y + ')');
await p.mouse.click(sx, sy);
await p.waitForTimeout(4000);
const st = await p.evaluate(() => ({ room: window.__penguin.scene.currentRoom,
  mapOpen: window.__penguin.scene.mapOpen, movie: !!window.__penguin.scene.movie }));
console.log('apos click:', JSON.stringify(st));
await p.screenshot({ path: 'shots/map-dock.png' });
await b.close();
