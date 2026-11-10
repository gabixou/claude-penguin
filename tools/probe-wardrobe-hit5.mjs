import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen && window.__penguin.scene.wardrobe.cells.length > 0, null, { timeout: 30000 });
await p.waitForTimeout(1000);
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
// para cada celula: move p/ centro, hitTest real, reporta indices atingidos
const res = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  const out = [];
  for (let i = 0; i < Math.min(6, w.cells.length); i++) {
    const c = w.cells[i];
    const b = c.getBounds();
    // getBounds pode ser impreciso p/ container; usa world matrix + hitArea
    const m = c.getWorldTransformMatrix();
    const cx = m.tx + 27, cy = m.ty + 27; // centro do hitArea 54x54
    // simula: chama hitTestPointer com pointer fake contendo worldX/worldY
    const fake = { worldX: cx, worldY: cy, x: cx, y: cy };
    const hits = sc.input.hitTestPointer(fake, w.cells);
    out.push({ i, cx: Math.round(cx), cy: Math.round(cy), hitIdx: hits.indexOf(c), n: hits.length });
  }
  return out;
});
console.log(JSON.stringify(res));
// e varredura fina na horizontal com hitTest real via mouse.move + activePointer
const line = [];
for (let wx = 500; wx <= 690; wx += 10) {
  const sx = rect.l + (wx/760)*rect.w, sy = rect.t + (157/480)*rect.h;
  await p.mouse.move(sx, sy);
  await p.waitForTimeout(60);
  const idx = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const ptr = sc.input.activePointer;
    const hits = sc.input.hitTestPointer(ptr, sc.wardrobe.cells);
    return hits.length ? sc.wardrobe.cells.indexOf(hits[0]) : -1;
  });
  line.push(wx + ':' + idx);
}
console.log(line.join(' '));
await b.close();
