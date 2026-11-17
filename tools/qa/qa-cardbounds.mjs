import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.playerCard.isOpen === true, null, { timeout: 30000 });
await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const c = s.playerCard.container;
  const wb = c.getBounds();
  // tambem: scale da cena p/ converter game->screen
  return { x: wb.x, y: wb.y, w: wb.width, h: wb.height,
    scaleX: s.cameras.main.width / s.scale.width, scaleY: s.cameras.main.height / s.scale.height,
    cam: { w: s.cameras.main.width, h: s.cameras.main.height } };
});
console.log(JSON.stringify(r));
await b.close();
