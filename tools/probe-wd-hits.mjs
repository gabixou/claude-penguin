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

const info = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  await w.open(sc.localPlayer);
  w.tab = 'head'; w.page = 0;
  await w._renderGrid();
  await new Promise(r => setTimeout(r, 800));
  const rect = sc.game.canvas.getBoundingClientRect();
  const toScreen = (wx, wy) => ({ x: rect.left + wx * rect.width / 760, y: rect.top + wy * rect.height / 480 });
  // centros das 12 celulas
  const cells = w.cells.map((c, i) => {
    const wx = w._gridX + c.x + 22, wy = w._gridY + c.y + 22;
    const s = toScreen(wx, wy);
    return { i, wx: Math.round(wx), wy: Math.round(wy), sx: Math.round(s.x), sy: Math.round(s.y) };
  });
  // tambem: onde o Phaser acha que esta o input da celula 0?
  const c0 = w.cells[0];
  const wb = c0.getWorldTransformMatrix();
  return {
    gridX: w._gridX, gridY: w._gridY,
    cell0pos: [c0.x, c0.y],
    worldMatrix: [wb.a, wb.b, wb.c, wb.d, wb.tx, wb.ty],
    cells,
    items: w._filteredItems().slice(0, 12).map(i => i.id + ':' + i.name),
    tabZones: (w.tabZones || []).map(z => ({ tab: z._tab, x: Math.round(z.x), y: Math.round(z.y), w: z.width, h: z.height })),
  };
});
console.log(JSON.stringify(info, null, 1));

// clica celulas 0,1,2 e le o que equipou
for (const idx of [0, 1, 2]) {
  const c = info.cells[idx];
  const before = await p.evaluate(() => window.__penguin.gpaOutfit?.head);
  await p.mouse.click(c.sx, c.sy);
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => window.__penguin.gpaOutfit?.head);
  console.log('click cell' + idx + ' @' + c.sx + ',' + c.sy + ' head: ' + before + ' -> ' + after + ' expected ' + info.items[idx]);
}
await b.close();
