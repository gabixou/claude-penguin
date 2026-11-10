import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(() => {
  const s = window.__penguin.scene, cam = s.cameras.main, c = s.game.canvas;
  const rect = c.getBoundingClientRect();
  let sp = null;
  try { const v = cam.getWorldPoint ? null : null; } catch(e){}
  // world->screen: Phaser camera.matrix e' a matriz world->screen
  try {
    const m = cam.matrix;
    const px = m.a*705.5 + m.c*181 + m.tx;
    const py = m.b*705.5 + m.d*181 + m.ty;
    sp = [px, py];
  } catch(e) { sp = 'err:'+e.message; }
  return { cw: c.width, ch: c.height, rect: [rect.width, rect.height, rect.left, rect.top], zoom: cam.zoom, scroll: [cam.scrollX, cam.scrollY], sp };
});
console.log(JSON.stringify(r));
await b.close();
