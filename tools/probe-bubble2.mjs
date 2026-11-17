import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.showChat('Waddle on! Teste.'));
await p.waitForTimeout(4000);
const st = await p.evaluate(() => {
  const lp = window.__penguin, scene = lp.scene;
  const key = lp._bubbleTexKey;
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const cx = c.getContext('2d'); cx.drawImage(src, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  let dark = 0, white = 0, transp = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 30) { transp++; continue; }
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < 100) dark++; else if (lum > 200) white++;
  }
  // posicao do balão no mundo
  const wp = lp.chatBubble.getWorldTransformMatrix ? null : null;
  return { key, w: src.width, h: src.height, dark, white, transp,
    bubPos: { x: lp.chatBubble.x, y: lp.chatBubble.y },
    pengPos: { x: lp.x, y: lp.y }, fonts: [...document.fonts].map(f => f.family + ':' + f.status) };
});
console.log(JSON.stringify(st, null, 1));
await b.close();
