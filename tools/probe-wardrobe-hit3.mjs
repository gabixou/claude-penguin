import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen && window.__penguin.scene.wardrobe.cells.length > 0, null, { timeout: 30000 });
await p.waitForTimeout(1500);
const info = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return {
    n: w.cells.length,
    cells: w.cells.slice(0, 6).map((c, i) => {
      const b = c.getBounds();
      return { i, bx: Math.round(b.x), by: Math.round(b.y), bw: Math.round(b.width), bh: Math.round(b.height) };
    }),
  };
});
console.log(JSON.stringify(info));
const hits = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  return w.cells.slice(0, 6).map((c, i) => {
    const b = c.getBounds();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const res = sc.input.hitTestPointer({ x: cx, y: cy, worldX: cx, worldY: cy });
    return { i, idx: res.indexOf(c), isTop: res[0] === c, n: res.length, top: res[0]?.type };
  });
});
console.log('hitTest:', JSON.stringify(hits));
await b.close();
