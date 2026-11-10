import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
// loader screenshot
await p.screenshot({ path: 'shots/loader-new.png', timeout: 120000 });
const loader = await p.evaluate(() => ({
  vis: !!window.__penguin?.scene?.loadingScreen?.visible,
  prog: window.__penguin?.scene?.loadingScreen?._barFill?.width,
}));
console.log('loader:', JSON.stringify(loader));
// espera sala ficar pronta
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
console.log('room ready');
// --- player card: abre e verifica preview rapido ---
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForTimeout(12000); // primeira carga do interface pack
const card1 = await p.evaluate(() => ({
  open: !!window.__penguin.scene.playerCard?.container,
  kids: window.__penguin.scene.playerCard?.container?.list?.length,
}));
console.log('card early:', JSON.stringify(card1));
await p.screenshot({ path: 'shots/pc-early.png' });
await p.waitForTimeout(20000); // papers
await p.screenshot({ path: 'shots/pc-late.png' });
// fecha pelo botao real (zona de menor y)
const pos = await p.evaluate(() => {
  const cont = window.__penguin.scene.playerCard.container;
  const z = cont.list.filter(o => o.type === 'Zone').reduce((a, b2) => (b2.y < a.y ? b2 : a));
  const m = z.getWorldTransformMatrix();
  const canvas = window.__penguin.scene.game.canvas.getBoundingClientRect();
  return { x: canvas.left + m.e * (canvas.width / 760), y: canvas.top + m.f * (canvas.height / 480) };
});
await p.mouse.click(pos.x, pos.y);
await p.waitForTimeout(800);
console.log('card closed:', await p.evaluate(() => !window.__penguin.scene.playerCard?.container));
// --- chat input: foca e digita ---
const inp = await p.evaluate(() => {
  const el = document.querySelector('input');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(el).display };
});
console.log('chat input:', JSON.stringify(inp));
await p.mouse.click(inp.x + inp.w / 2, inp.y + inp.h / 2);
await p.keyboard.type('ola mundo');
await p.keyboard.press('Enter');
await p.waitForTimeout(1000);
// balão: verifica textura do bubble do jogador local
const bub = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  const c = lp?.bubbleContainer;
  if (!c) return { none: true };
  const img = c.list.find(o => o.type === 'Image');
  return { kids: c.list.length, tex: img?.texture?.key, w: img?.width, h: img?.height };
});
console.log('bubble:', JSON.stringify(bub));
await p.screenshot({ path: 'shots/bubble-new.png' });
await b.close();
