import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen && window.__penguin.scene.wardrobe.cells.length > 0, null, { timeout: 30000 });
await p.waitForTimeout(1000);
const cam = await p.evaluate(() => {
  const c = window.__penguin.scene.cameras.main;
  return { zoom: c.zoom, scrollX: c.scrollX, scrollY: c.scrollY, w: c.width, h: c.height };
});
console.log('camera:', JSON.stringify(cam));
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
console.log('canvas css:', JSON.stringify(rect));
// move o mouse para um pixel conhecido e le worldX/worldY
for (const [wx, wy] of [[535, 157], [380, 240], [700, 400]]) {
  const sx = rect.l + (wx/760)*rect.w, sy = rect.t + (wy/480)*rect.h;
  await p.mouse.move(sx, sy);
  await p.waitForTimeout(150);
  const ptr = await p.evaluate(() => {
    const s = window.__penguin.scene;
    return { wx: +s.input.activePointer.worldX.toFixed(1), wy: +s.input.activePointer.worldY.toFixed(1), x: +s.input.activePointer.x.toFixed(1), y: +s.input.activePointer.y.toFixed(1) };
  });
  console.log('intended', wx, wy, '-> pointer', JSON.stringify(ptr));
}
await b.close();
