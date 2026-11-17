import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.playerCard.isOpen === true, null, { timeout: 30000 });
await p.waitForTimeout(1500);
// converte coords do jogo p/ pixels da pagina via bounding rect do canvas
const cv = await p.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const scale = Math.min(cv.w / 760, cv.h / 480);
console.log('canvas rect', JSON.stringify(cv), 'scale', scale);
const z = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const zone = s.playerCard.container?.list?.find((o) => o.name === 'pcard_rename');
  return zone ? { x: zone.getBounds().centerX, y: zone.getBounds().centerY } : null;
});
console.log('zone game coords', JSON.stringify(z));
if (z) {
  const px = cv.x + z.x * scale, py = cv.y + z.y * scale;
  await p.mouse.move(px, py, { steps: 8 });
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => {
    const t = window.__penguin.scene.playerCard._tooltip;
    return t ? { hasImage: !!t.image, tex: t.image?.texture?.key } : null;
  });
  console.log('tooltip state:', JSON.stringify(st));
  await p.screenshot({ path: 'shots/pcard-hint-hover.png' });
  // crop da regiao do card
  await p.screenshot({ path: 'shots/pcard-hint-card.png', clip: {
    x: cv.x, y: cv.y, width: cv.w, height: cv.h } });
}
await b.close();
