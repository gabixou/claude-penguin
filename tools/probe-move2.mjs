import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
await p.evaluate(() => {
  const s = window.__penguin.scene;
  window.__ev = [];
  s.input.on('pointerdown', ptr => window.__ev.push({ x: ptr.x, y: ptr.y, wx: ptr.worldX, wy: ptr.worldY }));
  // hit test num ponto equivalente
});
const cv = await p.$('canvas');
const box = await cv.boundingBox();
const cx = box.x + box.width * 0.7, cy = box.y + box.height * 0.55;
await p.mouse.click(cx, cy);
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const ptr = s.input.activePointer;
  return {
    ev: window.__ev,
    active: { x: ptr.x, y: ptr.y, wx: ptr.worldX, wy: ptr.worldY },
    hits: s.input.hitTestPointer(ptr).length,
    blockY: s.gpHud?.blockY,
    mapOpen: s.mapOpen, clothesOpen: s.clothesOpen,
    pos: { x: s.localPlayer.x, y: s.localPlayer.y },
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
