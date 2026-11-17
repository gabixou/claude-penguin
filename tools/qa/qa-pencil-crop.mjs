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
const z = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const zone = s.playerCard.container?.list?.find((o) => o.name === 'pcard_rename');
  const wb = zone.getBounds();
  return { x: wb.centerX, y: wb.centerY };
});
const cv = await p.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const scale = Math.min(cv.w / 760, cv.h / 480);
const px = cv.x + z.x * scale, py = cv.y + z.y * scale;
// recarrega com zoom via clip ampliado na regiao do botao
await p.screenshot({ path: 'shots/pencil-crop.png', clip: {
  x: px - 60, y: py - 60, width: 120, height: 120 } });
console.log('crop at', px, py);
await b.close();
