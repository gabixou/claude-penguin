import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes?.() ?? window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
await p.waitForTimeout(1200);
const info = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const cells = w.cells.slice(0, 6).map((c, i) => {
    const b = c.getBounds();
    return { i, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), cx: Math.round(c.x), cy: Math.round(c.y) };
  });
  const gc = w._gridCont.getBounds();
  return { cells, gridBounds: { x: Math.round(gc.x), y: Math.round(gc.y) }, gridPos: { x: w._gridCont.x, y: w._gridCont.y }, panel: { px: w._gridX, py: w._gridY } };
});
console.log(JSON.stringify(info, null, 1));
// hitTest manual: para cada celula, o centro dela retorna ela mesma no hitTestPointer?
const hits = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  return w.cells.slice(0, 6).map((c) => {
    const b = c.getBounds();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    // simula hit test na posicao mundo
    const res = sc.input.hitTestPointer({ x: cx, y: cy, worldX: cx, worldY: cy });
    return { cx: Math.round(cx), cy: Math.round(cy), hitIsCell: res.includes(c), hitCount: res.length, topType: res[0]?.type };
  });
});
console.log('hitTest:', JSON.stringify(hits));
await b.close();
