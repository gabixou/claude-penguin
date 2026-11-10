import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen && window.__penguin.scene.wardrobe.cells.length > 0, null, { timeout: 30000 });
await p.waitForTimeout(1200);
const g = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return w.cells.slice(0, 4).map((c, i) => {
    const ha = c.input?.hitArea;
    const m = c.getWorldTransformMatrix();
    const gm = w._gridCont.getWorldTransformMatrix();
    const cm = w.container.getWorldTransformMatrix();
    return {
      i, pos: { x: c.x, y: c.y }, scale: { x: c.scaleX, y: c.scaleY },
      hitArea: ha ? { x: ha.x, y: ha.y, w: ha.width, h: ha.height } : null,
      world: { a: +m.a.toFixed(3), b: +m.b.toFixed(3), c: +m.c.toFixed(3), d: +m.d.toFixed(3), x: +m.tx.toFixed(1), y: +m.ty.toFixed(1) },
      gridWorld: { x: +gm.tx.toFixed(1), y: +gm.ty.toFixed(1), a: +gm.a.toFixed(3), d: +gm.d.toFixed(3) },
      camZoom: window.__penguin.scene.cameras.main.zoom,
    };
  });
});
console.log(JSON.stringify(g, null, 1));
await b.close();
