import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const { assetMovie } = await import('/src/ui/paperDoll.js');
  const pm = await assetMovie('icons', 402);
  const exportName = Object.keys(pm.data?.exports || {})[0];
  const spriteId = exportName;
  const sprite = pm.sprites?.[spriteId];
  const entry = sprite?.frames?.[0]?.[0];
  const charId = String(entry?.id);
  const char = pm.characters?.[charId];
  const svgText = pm._svgText(char?.file);
  // renderiza SVG em canvas
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  });
  ctx.drawImage(img, 0, 0, 100, 100);
  const d = ctx.getImageData(0, 0, 100, 100).data;
  let nonTransparent = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] > 30) nonTransparent++;
  }
  return { nonTransparent, svgLen: svgText?.length, charSize: char?.size };
});
console.log(JSON.stringify(r));
await b.close();
