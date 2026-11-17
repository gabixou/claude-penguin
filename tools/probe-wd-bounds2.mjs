import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
// compra alguns itens p/ o guest ter o que mostrar
await p.evaluate(() => {
  const n = window.__penguin.scene.network;
  [402, 431, 408, 1, 10, 100].forEach(id => n.send('BUY_ITEM', { itemId: id }));
});
await p.waitForTimeout(1500);
await p.evaluate(() => { window.__penguin.scene.wardrobe?.open?.(); });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene, w = s.wardrobe;
  if (!w?.isOpen) return { open: false };
  const cells = (w.cells || []).slice(0, 12).map(c => {
    const img = c.list.find(o => o.type === 'Image');
    if (!img) return { id: c.itemId, img: false };
    const wb = img.getBounds();
    return { id: c.itemId, w: +wb.width.toFixed(1), h: +wb.height.toFixed(1), texW: img.texture.source[0].width, texH: img.texture.source[0].height, scale: +img.scaleX.toFixed(3) };
  });
  return { open: true, tab: w.tab, n: w.cells.length, cells };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/wd-bounds2.png' });
await b.close();
