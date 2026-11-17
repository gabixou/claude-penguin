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
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const card = s.playerCard.container;
  const zone = card?.list?.find((o) => o.name === 'pcard_rename');
  const tip = s.playerCard._tooltip;
  const out = { zone: zone && { x: zone.x, y: zone.y, w: zone.width, h: zone.height }, cont: { x: card.x, y: card.y, scale: card.scaleX } };
  if (!zone || !tip) return out;
  await tip.show(zone.x - zone.width / 2, zone.y - zone.height / 2, zone.width, zone.height, 'Rename penguin');
  await new Promise((r2) => setTimeout(r2, 300));
  if (tip.image) {
    const wb = tip.image.getBounds();
    out.tipBounds = { x: wb.x, y: wb.y, w: wb.width, h: wb.height };
    out.zoneScreen = zone.getBounds();
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
if (r.tipBounds) {
  const pad = 30;
  await p.screenshot({ path: 'shots/pcard-tipcrop.png', clip: {
    x: Math.max(0, r.tipBounds.x - pad), y: Math.max(0, r.tipBounds.y - pad),
    width: r.tipBounds.w + pad * 2, height: r.tipBounds.h + pad * 2 } });
}
await b.close();
