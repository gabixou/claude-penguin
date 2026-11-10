import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const ls = window.__penguin.scene.loadingScreen;
  return !ls || !ls.visible;
}, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(1000);

const pos = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  await w.open(sc.localPlayer);
  w.tab = 'body'; w.page = 0;
  await w._renderGrid();
  await new Promise(r => setTimeout(r, 600));
  const cell = w.cells[0];
  const wx = w._gridX + cell.x + 22;
  const wy = w._gridY + cell.y + 22;
  const rect = sc.game.canvas.getBoundingClientRect();
  const sx = rect.width / 760, sy = rect.height / 480;
  return {
    wx, wy,
    sx: rect.left + wx * sx,
    sy: rect.top + wy * sy,
    cellX: cell.x, cellY: cell.y, gridX: w._gridX, gridY: w._gridY,
    inputEnabled: cell.input ? cell.input.enabled : 'noinput',
    hitTest: (() => { try { return sc.input.hitTestPointer({ x: wx, y: wy, worldX: wx, worldY: wy }).length; } catch(e){ return 'err:'+e.message; } })(),
  };
});
console.log(JSON.stringify(pos));
await p.mouse.click(pos.sx, pos.sy);
await p.waitForTimeout(5000);
const after = await p.evaluate(() => {
  const pg = window.__penguin;
  return { outfitBody: pg.gpaOutfit?.body, lookBody: pg.view.look.body };
});
console.log('after', JSON.stringify(after));
await b.close();
