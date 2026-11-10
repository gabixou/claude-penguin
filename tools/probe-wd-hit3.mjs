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
  await new Promise(r => setTimeout(r, 500));
});
// testa hitTest em: aba head (518,112), celula0 (522,150), scrollbar up, search
const pts = { tab: [518, 112], cell0: [522, 150], cell5: [618, 198], closeX: [748, 97], search: [600, 372] };
for (const [name, [wx, wy]] of Object.entries(pts)) {
  const rect = await p.evaluate(() => {
    const r = window.__penguin.scene.game.canvas.getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  });
  const sx = rect.l + wx * rect.w / 760, sy = rect.t + wy * rect.h / 480;
  await p.mouse.move(sx, sy);
  await p.waitForTimeout(120);
  const res = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const ptr = sc.input.activePointer;
    const hits = sc.input.hitTestPointer(ptr);
    return { wx: Math.round(ptr.worldX), wy: Math.round(ptr.worldY), n: hits.length, top: hits.slice(0, 4).map(o => o.type + ':' + (o._tab || o.texture?.key || o.name || (o.input ? 'interactive' : '?'))) };
  });
  console.log(name, JSON.stringify(res));
}
await b.close();
