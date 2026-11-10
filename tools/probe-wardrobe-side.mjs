import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
// abre player card primeiro
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin));
await p.waitForTimeout(3000);
// depois abre wardrobe
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin));
await p.waitForTimeout(20000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return {
    pcardOpen: s.playerCard?.isOpen,
    wardrobeOpen: s.wardrobe?.isOpen,
    pcardBounds: s.playerCard?.container ? s.playerCard.container.getBounds() : null,
    wardrobeBounds: s.wardrobe?.container ? s.wardrobe.container.getBounds() : null,
    cells: s.wardrobe?.cells?.length,
    page: s.wardrobe?.page,
    totalPages: s.wardrobe?._totalPages()
  };
});
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: 'tools/shots/wardrobe-side.png' });
await b.close();
