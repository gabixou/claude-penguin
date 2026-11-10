import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(20000);
const info = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  const cam = window.__penguin.scene.cameras.main;
  return { rect: { x: r.x, y: r.y, w: r.width, h: r.height },
           x: window.__penguin.x, y: window.__penguin.y,
           zoom: cam.zoom, scrollX: cam.scrollX, scrollY: cam.scrollY };
});
console.log(JSON.stringify(info));
const toScreen = (wx, wy) => ({
  x: info.rect.x + (wx - info.scrollX) * info.zoom,
  y: info.rect.y + (wy - info.scrollY) * info.zoom });
const s = toScreen(info.x, info.y);
const clip = { x: Math.max(0, Math.round(s.x - 90)), y: Math.max(0, Math.round(s.y - 90)),
               width: 180, height: 180 };
console.log('clip', JSON.stringify(clip));
await p.screenshot({ path: 'tools/shots/penguin-vector.png', clip, timeout: 120000 });
// click a world point ~150px right of penguin
const t = toScreen(info.x + 150, info.y - 30);
await p.mouse.click(t.x, t.y);
await p.waitForTimeout(500);
const info2 = await p.evaluate(() => ({ x: window.__penguin.x, y: window.__penguin.y,
  frame: window.__penguin.view ? window.__penguin.view.frame : null }));
console.log('after', JSON.stringify(info2));
await p.screenshot({ path: 'tools/shots/penguin-walk.png', clip, timeout: 120000 });
await b.close();
console.log('done');
