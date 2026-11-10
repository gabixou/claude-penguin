import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => {
    const sc = window.__penguin?.scene;
    return !!(sc && sc._movieReady && sc.localPlayer?.view);
  }).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
// abre o mapa
await p.evaluate(() => window.__penguin.scene.toggleMap());
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(1000);
  const st = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const c = sc.islandMap?.container;
    return c ? { built: true, children: c.list.length, visible: c.visible, dimVis: sc.islandMap.dim?.visible } : { built: false };
  }).catch((e) => ({ err: String(e).slice(0, 100) }));
  if (st.built && st.visible) { console.log('map built:', JSON.stringify(st), 'em', i + 1, 's'); break; }
  if (i === 39) console.log('final', JSON.stringify(st));
}
await p.screenshot({ path: 'shots/map-test.png' });
// clica na zona do dock (btn em x~195,y~278 mundo) para testar changeRoom
const c2 = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const canvas = document.querySelector('canvas').getBoundingClientRect();
  return { left: canvas.left, top: canvas.top, w: canvas.width, h: canvas.height };
});
// dock_btn bounds aprox: centro ~(195,278) em coords do stage (bounds 0..760)
const sx = c2.left + (195 / 760) * c2.w, sy = c2.top + (278 / 480) * c2.h;
console.log('click dock em', sx.toFixed(0), sy.toFixed(0));
await p.mouse.click(sx, sy);
await p.waitForTimeout(3000);
const room = await p.evaluate(() => window.__penguin.scene.currentRoom);
console.log('room apos click:', room);
await p.screenshot({ path: 'shots/map-after-click.png' });
await b.close();
