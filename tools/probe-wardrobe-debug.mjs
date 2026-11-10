import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => { if (m.text().includes('[wardrobe]')) console.log('CON:', m.text()); });
p.on('pageerror', e => console.log('ERR:', e.message));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(30000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  if (!w?.isOpen) return 'not open';
  const cells = w.cells?.map(c => ({
    children: c.list.map(k => ({ type: k.type, tex: k.texture?.key, vis: k.visible })),
    destroyed: c.destroyed
  }));
  return {
    open: w.isOpen,
    cells: w.cells?.length,
    page: w.page,
    totalPages: w._totalPages(),
    iconTex: Array.from(w._iconTex.entries()).map(([k,v]) => ({id:k, key:v})),
    cellDetails: cells?.slice(0,3)
  };
});
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: 'tools/shots/wardrobe-debug.png' });
await b.close();
