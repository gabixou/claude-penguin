import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.type(), m.text().slice(0, 160)); });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1000);
// abre o player card do proprio jogador
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.playerCard.isOpen === true, null, { timeout: 30000 });
await p.waitForTimeout(2500); // papers/repaint
await p.screenshot({ path: 'shots/v3000-pcard.png' });
// localiza a zona do botao rename (moderatorButtonEditPlayer -> zone pcard_rename)
const info = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const card = s.playerCard.container;
  const zone = card?.list?.find((o) => o.name === 'pcard_rename');
  if (!zone) return null;
  const wb = zone.getBounds();
  return { x: wb.centerX, y: wb.centerY, w: wb.width, h: wb.height };
});
console.log('rename zone:', JSON.stringify(info));
if (info) {
  // hover no botao -> tooltip
  await p.mouse.move(info.x, info.y, { steps: 5 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'shots/v3000-tooltip.png' });
  // estado interno do tooltip
  const st = await p.evaluate(() => {
    const t = window.__penguin.scene.playerCard._tooltip;
    return t ? { hasImage: !!t.image, tex: t.image?.texture?.key } : null;
  });
  console.log('tooltip state:', JSON.stringify(st));
}
await b.close();
