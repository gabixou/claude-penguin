import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
await p.waitForTimeout(800);
const info = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const c = w.container.list.find(o => o.type === 'Zone' && o.input?.enabled);
  return { cells: w.cells.length, panelBlock: !!c, owned: w.ownedIds?.size };
});
console.log('wardrobe:', JSON.stringify(info));
// clica numa area morta do painel (canto superior direito, dentro do painel)
const dead = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  // canto inferior esquerdo do painel (longe de celulas/pill)
  const gb = w._gridCont.getBounds();
  return [gb.x - 2, gb.y + gb.height + 30]; // abaixo do grid, acima da pill? testa
});
console.log('dead click at', dead);
await p.evaluate(([x, y]) => {
  const zone = window.__penguin.scene.wardrobe.container.list.find(o => o.type === 'Zone');
  zone.emit('pointerdown', { worldX: x, worldY: y });
}, dead);
await p.waitForTimeout(300);
console.log('apos clique area morta, aberto?', await p.evaluate(() => window.__penguin.scene.wardrobe?.isOpen), 'card?', await p.evaluate(() => window.__penguin.scene.playerCard?.isOpen));
// agora clique real via input do Phaser num item
const cell = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const b = w.cells[0].getBounds();
  const rect = window.__penguin.scene.game.canvas.getBoundingClientRect();
  const sx = rect.width / 760, sy = rect.height / 480;
  return [rect.left + b.centerX * sx, rect.top + b.centerY * sy];
});
console.log('cell screen pos', cell);
await p.mouse.click(cell[0], cell[1]);
await p.waitForTimeout(500);
console.log('apos clique item, aberto?', await p.evaluate(() => window.__penguin.scene.wardrobe?.isOpen));
await p.screenshot({ path: 'shots/wardrobe-fixed.png' });
await b.close();
