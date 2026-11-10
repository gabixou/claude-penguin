import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
p.on('console', m => { const t = m.text(); if (t.includes('wardrobe') || t.includes('paperdoll')) console.log('[pg]', t.slice(0, 200)); });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
console.log('room ready');
// abre guarda-roupa
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(3000);
const st = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { open: w?.isOpen, items: w?.items?.length, cells: w?._gridCont?.list?.length, dollTex: !!w?._dollImg?.texture };
});
console.log('wardrobe:', JSON.stringify(st));
await p.waitForTimeout(15000); // doll + icones
await p.screenshot({ path: 'shots/wardrobe-1.png', timeout: 120000 });
// clica numa celula de item (head) para equipar
const pick = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const cell = w._gridCont.list.find(c => c.input);
  if (!cell) return null;
  const m = cell.getWorldTransformMatrix();
  const canvas = window.__penguin.scene.game.canvas.getBoundingClientRect();
  return { x: canvas.left + m.e * (canvas.width / 760), y: canvas.top + m.f * (canvas.height / 480) };
});
console.log('cell pos:', JSON.stringify(pick));
if (pick) {
  await p.mouse.click(pick.x, pick.y);
  await p.waitForTimeout(1500);
  const eq = await p.evaluate(() => window.__penguin.scene.localPlayer.gpaOutfit);
  console.log('outfit after pick:', JSON.stringify(eq));
  await p.screenshot({ path: 'shots/wardrobe-2.png', timeout: 120000 });
}
// aba color
await p.evaluate(() => { window.__penguin.scene.wardrobe.tab = 'color'; window.__penguin.scene.wardrobe._refreshTabs(); window.__penguin.scene.wardrobe._renderGrid(); });
await p.waitForTimeout(1000);
await p.screenshot({ path: 'shots/wardrobe-color.png', timeout: 120000 });
await b.close();
