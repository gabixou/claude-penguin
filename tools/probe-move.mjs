import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
const before = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { x: s.localPlayer.x, y: s.localPlayer.y };
});
console.log('before:', JSON.stringify(before));
// clique no quadrante inferior-direito do canvas (area de jogo, fora do HUD)
const cv = await p.$('canvas');
const box = await cv.boundingBox();
await p.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.55);
await p.waitForTimeout(2500);
const after = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { x: s.localPlayer.x, y: s.localPlayer.y, moving: !!s.localPlayer.tween };
});
console.log('after:', JSON.stringify(after));
await b.close();
