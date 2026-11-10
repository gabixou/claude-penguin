import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(12000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const img = w.cells[0].list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  const tex = s.textures.get(img.texture.key).getSourceImage();
  const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height;
  const ctx = c.getContext('2d'); ctx.drawImage(tex, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let nonTransparent = 0, dark = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] > 30) { nonTransparent++; if (d[i-3] < 100 && d[i-2] < 100 && d[i-1] < 100) dark++; }
  }
  return { key: img.texture.key, w: tex.width, h: tex.height, disp: [img.displayWidth, img.displayHeight], nonTransparent, dark };
});
console.log(JSON.stringify(r));
await b.close();
