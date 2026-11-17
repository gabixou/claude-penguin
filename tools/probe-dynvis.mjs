import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const out = { dyns: [], segsVis: 0, segsTot: 0 };
  for (const s of (sc.movieLayers || [])) { out.segsTot++; if (s.img?.visible) out.segsVis++; }
  for (const d of (sc._dynList || [])) {
    const img = d.img;
    if (!img) { out.dyns.push({ path: d.path, img: null }); continue; }
    const bd = img.getBounds();
    out.dyns.push({
      path: d.path.split('.').pop(), depth: d.depth,
      vis: img.visible, alpha: img.alpha, active: img.active,
      x: +img.x.toFixed(1), y: +img.y.toFixed(1),
      disp: [+img.displayWidth.toFixed(0), +img.displayHeight.toFixed(0)],
      bounds: [Math.round(bd.x), Math.round(bd.y), Math.round(bd.width), Math.round(bd.height)],
      texW: img.texture?.getSourceImage?.()?.width,
      inScene: img.scene === sc,
    });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.screenshot({ path: 'shots/town-now.png' });
await b.close();
