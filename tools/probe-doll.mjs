import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
for (let i = 0; i < 90; i++) {
  const open = await p.evaluate(() => !!window.__penguin.scene.playerCard?.container).catch(() => false);
  if (open) break;
  await p.waitForTimeout(1000);
}
const scan = () => p.evaluate(() => {
  const scene = window.__penguin.scene;
  const lp = scene.localPlayer;
  const img = scene.playerCard.container.list.find(o => o.type === 'Image');
  const src = scene.textures.get(img.texture.key).getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const col = lp.penguinColor || 0;
  const tr = (col >> 16) & 255, tg = (col >> 8) & 255, tb = col & 255;
  let white = 0, colMatch = 0, total = 0;
  for (let yy = Math.floor(c.height * 0.3); yy < c.height * 0.8; yy++)
    for (let xx = Math.floor(c.width * 0.25); xx < c.width * 0.75; xx++) {
      const i = (yy * c.width + xx) * 4;
      if (d[i+3] < 40) continue; total++;
      const lum = 0.3*d[i]+0.6*d[i+1]+0.1*d[i+2];
      if (lum > 225) white++;
      if (Math.abs(d[i]-tr)<25 && Math.abs(d[i+1]-tg)<25 && Math.abs(d[i+2]-tb)<25) colMatch++;
    }
  return { color: col.toString(16), white, colMatch, total };
});
console.log('early:', JSON.stringify(await scan()));
await p.waitForTimeout(25000);
console.log('late :', JSON.stringify(await scan()));
await p.screenshot({ path: 'shots/pc-doll.png', timeout: 120000 });
await b.close();
