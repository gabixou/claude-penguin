import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const ls = window.__penguin.scene.loadingScreen;
  return !ls || !ls.visible;
}, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(1000);
await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  await sc.wardrobe.open(sc.localPlayer);
  await new Promise(r => setTimeout(r, 1500));
});
const rect = await p.evaluate(() => {
  const r = window.__penguin.scene.game.canvas.getBoundingClientRect();
  return { l: r.left, t: r.top, w: r.width, h: r.height };
});
const toS = (wx, wy) => ({ x: rect.l + wx * rect.w / 760, y: rect.t + wy * rect.h / 480 });
// clica celulas head: (0,0)=402, (1,0)=431, (2,0)=408 — centros wx=gridX+x+22
const clicks = [[522, 150], [570, 150], [522, 198]];
for (const [wx, wy] of clicks) {
  const s = toS(wx, wy);
  const before = await p.evaluate(() => window.__penguin.gpaOutfit?.head);
  await p.mouse.click(s.x, s.y);
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => window.__penguin.gpaOutfit?.head);
  console.log('click@' + wx + ',' + wy + ' head ' + before + ' -> ' + after);
}
// clica aba 'body' (zone center ~625,112)
const tb = toS(625, 112);
await p.mouse.click(tb.x, tb.y);
await p.waitForTimeout(600);
console.log('tab now:', await p.evaluate(() => window.__penguin.scene.wardrobe.tab),
  'cells:', await p.evaluate(() => window.__penguin.scene.wardrobe.cells.length));
await b.close();
