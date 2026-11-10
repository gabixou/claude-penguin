import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen && window.__penguin.scene.wardrobe.cells.length > 0, null, { timeout: 30000 });
await p.waitForTimeout(1200);
await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  w._origPick = w._pickItem.bind(w);
  window.__picked = [];
  w._pickItem = (item) => { window.__picked.push(item.id); };
});
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
// sweep horizontal y=157 de x=500 a 700 de 4 em 4
const res = [];
for (let wx = 500; wx <= 700; wx += 4) {
  await p.evaluate(() => { window.__picked = []; });
  await p.mouse.click(rect.l + (wx/760)*rect.w, rect.t + (157/480)*rect.h);
  await p.waitForTimeout(120);
  const picked = await p.evaluate(() => window.__picked);
  res.push(wx + ':' + (picked[0] ?? '-'));
}
console.log(res.join(' '));
await b.close();
