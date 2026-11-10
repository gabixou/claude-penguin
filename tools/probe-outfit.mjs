import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 60000 });
await p.waitForTimeout(6000); // espera clips de roupa carregarem
const info = await p.evaluate(() => {
  const v = window.__penguin.view;
  return {
    look: v.look,
    items: [...v.items.keys()],
    drawnFrame: v.drawnFrame,
    outfit: window.__penguin.gpaOutfit,
  };
});
console.log(JSON.stringify(info));
// screenshot do pinguim
const box = await p.evaluate(() => {
  const s = window.__penguin.sprite;
  const b = s.getBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
console.log('sprite bounds', JSON.stringify(box));
await p.screenshot({ path: 'tools/shots/probe-outfit.png' });
await b.close();
