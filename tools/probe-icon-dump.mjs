import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => {
  const n = window.__penguin.scene.network;
  [402, 431, 408, 200, 100, 355].forEach(id => n.send('BUY_ITEM', { itemId: id }));
});
await p.waitForTimeout(1500);
await p.evaluate(() => { window.__penguin.scene.wardrobe?.open?.(); });
await p.waitForTimeout(3500);
const ids = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const ids = (w.cells || []).map(c => c.itemId).filter(Boolean).slice(0, 8);
  const out = {};
  for (const id of ids) {
    const key = await w._iconTexture(id);
    const tex = key && s.textures.get(key);
    if (!tex) { out[id] = null; continue; }
    const src = tex.getSourceImage();
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    out[id] = c.toDataURL('image/png');
  }
  return out;
});
for (const [id, url] of Object.entries(ids)) {
  if (url) fs.writeFileSync('shots/icon-' + id + '.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log(id, url ? 'saved' : 'null');
}
await p.screenshot({ path: 'shots/wd-now.png' });
await b.close();
