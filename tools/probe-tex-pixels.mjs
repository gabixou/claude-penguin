import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(30000);
await p.waitForFunction(() => {
  const w = window.__penguin.scene.wardrobe;
  return w?.cells?.every(c => c.list.some(k => k.type === 'Image'));
}, null, { timeout: 30000 }).catch(() => {});
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  const tex = s.textures.get(img.texture.key);
  const src = tex.source[0];
  // desenha a textura fonte num canvas e conta pixels
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src.image, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let transparent = 0, black = 0, white = 0, colored = 0, total = d.length/4;
  const colors = {};
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i+3];
    if (a < 30) { transparent++; continue; }
    const r=d[i], g=d[i+1], b=d[i+2];
    if (r<30&&g<30&&b<30) black++;
    else if (r>220&&g>220&&b>220) white++;
    else colored++;
    const key = (r>>4)+','+(g>>4)+','+(b>>4);
    colors[key] = (colors[key]||0)+1;
  }
  const top = Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,10);
  return { texW: src.width, texH: src.height, transparent, black, white, colored, total, top };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
