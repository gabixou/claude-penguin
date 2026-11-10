import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(20000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  if (!w?.cells?.length) return 'no cells';
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  const tex = s.textures.get(img.texture.key).getSourceImage();
  const c = document.createElement('canvas');
  c.width = tex.width; c.height = tex.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(tex, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let nonTransparent = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] > 30) nonTransparent++;
  }
  return { key: img.texture.key, w: tex.width, h: tex.height, nonTransparent, total: d.length / 4 };
});
console.log(JSON.stringify(r));
await b.close();
