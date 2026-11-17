import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
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
const dataUrl = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const tip = s.playerCard._tooltip;
  const card = s.playerCard.container;
  const zone = card?.list?.find((o) => o.name === 'pcard_rename');
  await tip.show(zone.x - zone.width / 2, zone.y - zone.height / 2, zone.width, zone.height, 'Rename penguin');
  await new Promise((r) => setTimeout(r, 400));
  const img = tip.image;
  if (!img) return 'NOIMG';
  const src = img.texture.getSourceImage();
  return src.toDataURL('image/png');
});
if (dataUrl.startsWith('data:')) {
  writeFileSync('shots/tooltip-tex.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('saved shots/tooltip-tex.png');
} else console.log(dataUrl);
await b.close();
