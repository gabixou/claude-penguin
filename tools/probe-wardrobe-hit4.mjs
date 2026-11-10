import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen && window.__penguin.scene.wardrobe.cells.length > 0, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  w._origPick = w._pickItem.bind(w);
  window.__picked = [];
  w._pickItem = (item) => { window.__picked.push(item.id); w._origPick(item); };
});
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const cellInfo = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return w.cells.slice(0, 4).map((c, i) => {
    const b = c.getBounds();
    return { i, sx: (b.x + b.width/2), sy: (b.y + b.height/2), bx: Math.round(b.x), by: Math.round(b.y), bw: Math.round(b.width), bh: Math.round(b.height) };
  });
});
console.log(JSON.stringify(cellInfo));
for (const c of cellInfo) {
  await p.evaluate(() => { window.__picked = []; });
  await p.mouse.click(rect.l + (c.sx/760)*rect.w, rect.t + (c.sy/480)*rect.h);
  await p.waitForTimeout(400);
  const picked = await p.evaluate(() => window.__picked);
  console.log('click cell' + c.i + ' @(' + Math.round(c.sx) + ',' + Math.round(c.sy) + ') picked=' + JSON.stringify(picked));
}
await b.close();
