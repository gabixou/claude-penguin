import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(30000);
await p.waitForFunction(() => {
  const w = window.__penguin.scene.wardrobe;
  if (!w?.cells?.length) return false;
  return w.cells.every(c => c.list.some(k => k.type === 'Image' && k.texture?.key?.startsWith('wardrobe_icon_')));
}, null, { timeout: 30000 }).catch(() => {});
// testa desenhar o SVG diretamente num canvas para ver se o problema é do SVG ou do Phaser
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  const tex = s.textures.get(img.texture.key);
  const src = tex.source[0];
  // desenha a imagem fonte num canvas novo
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  // tenta desenhar a imagem original
  if (src.image) {
    ctx.drawImage(src.image, 0, 0);
  }
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let transparent = 0, black = 0, white = 0, total = d.length/4;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i+3];
    if (a < 30) transparent++;
    else if (d[i] < 30 && d[i+1] < 30 && d[i+2] < 30) black++;
    else if (d[i] > 220 && d[i+1] > 220 && d[i+2] > 220) white++;
  }
  // verifica o SVG original
  const svgText = await s.wardrobe._iconTex.get(402) ? null : null;
  return { srcW: src.width, srcH: src.height, transparent, black, white, total,
    imgType: src.image?.constructor?.name, imgSrc: src.image?.src?.substring(0,100) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
