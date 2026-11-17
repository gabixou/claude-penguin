import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForTimeout(9000);
const info = await p.evaluate(() => {
  const pc = window.__penguin.scene.playerCard;
  const zones = pc.container.list.filter(k => k.type === 'Zone').map(z => {
    const b2 = z.getBounds();
    return { name: z.name, x: b2.x, y: b2.y, w: b2.width, h: b2.height };
  });
  return { open: pc.isOpen, zones, canvas: (() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return {l:r.left,t:r.top,w:r.width,h:r.height}; })() };
});
console.log(JSON.stringify(info, null, 1));
// clica no centro da zona close
const cv = info.canvas;
const zx = info.zones.find(z => z.name === 'pcard_close');
if (zx) {
  const sx = cv.l + (zx.x + zx.w / 2) / 760 * cv.w;
  const sy = cv.t + (zx.y + zx.h / 2) / 480 * cv.h;
  console.log('click close at', sx, sy);
  await p.mouse.click(sx, sy);
  await p.waitForTimeout(800);
  console.log('after:', await p.evaluate(() => window.__penguin.scene.playerCard.isOpen));
}
await b.close();
