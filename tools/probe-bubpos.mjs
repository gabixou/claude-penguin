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
// envia chat direto
await p.evaluate(() => window.__penguin.scene.localPlayer.showChat('ola mundo'));
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  const c = lp.chatBubble;
  const img = c.list.find(o => o.type === 'Image');
  const m = img.getWorldTransformMatrix();
  const canvas = window.__penguin.scene.game.canvas.getBoundingClientRect();
  return {
    imgY: m.f, imgX: m.e, w: img.displayWidth, h: img.displayHeight,
    originX: img.originX, originY: img.originY,
    canvas: { left: canvas.left, top: canvas.top, w: canvas.width, h: canvas.height },
  };
});
console.log(JSON.stringify(info));
// screen coords do centro do balão
const cx = info.canvas.left + info.imgX * (info.canvas.w / 760);
const cy = info.canvas.top + (info.imgY + info.h / 2) * (info.canvas.h / 480);
console.log('screen center ~', cx, cy);
await p.screenshot({ path: 'shots/bub-full.png', timeout: 120000 });
await b.close();
