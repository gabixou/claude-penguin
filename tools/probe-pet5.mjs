import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => { window.__penguin.scene.changeRoom('pet'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 1500));
// descobre world point real do clique via getWorldPoint
const w = await p.evaluate(() => {
  const s = window.__penguin.scene, cam = s.cameras.main, c = s.game.canvas;
  const rect = c.getBoundingClientRect();
  // canvas px alvo = world (690,245) via matrix
  const m = cam.matrix;
  const px = m.a*690 + m.c*245 + m.tx, py = m.b*690 + m.d*245 + m.ty;
  const wp = cam.getWorldPoint(px, py);
  const ba = s._interactions.buttonAt(wp.x, wp.y);
  return { px, py, wp: [wp.x, wp.y], ba: ba?.path, ct: s._interactions.clickTarget(wp.x, wp.y) };
});
console.log('WORLD:', JSON.stringify(w));
// clica de verdade nas coords CSS derivadas
const c = await p.evaluate(() => {
  const s = window.__penguin.scene, cam = s.cameras.main, cv = s.game.canvas;
  const rect = cv.getBoundingClientRect();
  const m = cam.matrix;
  const px = m.a*690 + m.c*245 + m.tx, py = m.b*690 + m.d*245 + m.ty;
  const k = rect.width / cv.width;
  return { sx: rect.left + px*k, sy: rect.top + py*k };
});
console.log('CSS:', JSON.stringify(c));
await p.mouse.click(c.sx, c.sy);
await p.waitForTimeout(5000);
const st = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { room: s.currentRoom, pos: [s.localPlayer?.x, s.localPlayer?.y], iframe: !!document.querySelector('iframe[src*="pufflescape"]'), overlay: !!document.querySelector('div[style*="z-index: 10000"]') };
});
console.log('STATE:', JSON.stringify(st));
await p.screenshot({ path: 'shots/pet-after.png' });
await b.close();
