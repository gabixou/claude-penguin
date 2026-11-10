import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  // carrega o pack do icone 402 direto via Wardrobe._iconTexture? nao — usa assetMovie
  // assetMovie esta em items/catalog? procurar no modulo da cena
  const s = window.__penguin.scene;
  // fallback: wardrobe._iconTexture ja cacheia; chamamos e pegamos a textura
  s.wardrobe?.open?.();
  await new Promise(r => setTimeout(r, 2000));
  const w = s.wardrobe;
  const out = {};
  for (const id of [402, 431, 408]) {
    const key = await w._iconTexture(id);
    const tex = key && s.textures.get(key);
    if (!tex) { out[id] = 'null'; continue; }
    const src = tex.getSourceImage();
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    out[id] = { url: c.toDataURL('image/png'), w: src.width, h: src.height };
  }
  return out;
});
for (const [id, v] of Object.entries(r)) {
  if (v && v.url) { fs.writeFileSync('shots/icon-' + id + '.png', Buffer.from(v.url.split(',')[1], 'base64')); console.log(id, v.w + 'x' + v.h); }
  else console.log(id, v);
}
await b.close();
