import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(3500);
const st = await p.evaluate(async () => {
  const w = window.__penguin.scene.buddyWindow;
  if (!w._ready) await new Promise(r => setTimeout(r, 3000));
  const tex = w.scene.textures.get(w.texKey);
  return {
    imgScale: [w.img.scaleX, w.img.scaleY],
    imgDW: w.img.displayWidth, imgDH: w.img.displayHeight,
    texW: tex?.source?.[0]?.width, texH: tex?.source?.[0]?.height,
    canvas: [w.canvas.width, w.canvas.height],
    world: [w.scene.scale.width, w.scene.scale.height],
    camZoom: w.scene.cameras.main.zoom,
  };
});
console.log(JSON.stringify(st));
await b.close();
