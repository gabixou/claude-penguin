import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1000);
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.playerCard.isOpen === true, null, { timeout: 30000 });
await p.waitForTimeout(2500);
// forca o hint diretamente (hover nao dispara em headless)
const st = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const t = s.playerCard._tooltip || (s.playerCard._tooltip = new (Object.getPrototypeOf(s.playerCard).constructor, null), null);
  return null;
});
// mais simples: cria via import dinamico nao da — usa o show ja ligado? chama zone emit
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const card = s.playerCard.container;
  const zone = card?.list?.find((o) => o.name === 'pcard_rename');
  if (!zone) return { err: 'no zone' };
  const wb = zone.getBounds();
  // dispara pointerover manual no zone
  zone.emit('pointerover', { x: wb.centerX, y: wb.centerY });
  return { emitted: true };
});
console.log('emit:', JSON.stringify(r));
await p.waitForTimeout(800);
const st2 = await p.evaluate(() => {
  const t = window.__penguin.scene.playerCard._tooltip;
  return t ? { hasImage: !!t.image, visible: t.image?.visible, tex: t.image?.texture?.key } : null;
});
console.log('tooltip:', JSON.stringify(st2));
await p.screenshot({ path: 'shots/v3000-hint.png' });
await b.close();
