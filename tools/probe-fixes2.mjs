import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', m => { if (m.type() === 'error' || m.text().includes('playercard')) console.log('[pg]', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
console.log('room ready');
// chat rect real
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { rect: s._chatInputGameRect, hud: s.gpHud?._chatRect };
});
console.log('chatRect:', JSON.stringify(r));
// abre card e espera de verdade
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
for (let i = 0; i < 90; i++) {
  const open = await p.evaluate(() => !!window.__penguin.scene.playerCard?.container).catch(() => false);
  if (open) { console.log('card open after', i, 's'); break; }
  await p.waitForTimeout(1000);
}
await p.waitForTimeout(3000);
await p.screenshot({ path: 'shots/pc-early2.png', timeout: 120000 });
// espera papers
await p.waitForTimeout(25000);
await p.screenshot({ path: 'shots/pc-late2.png', timeout: 120000 });
// fecha
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
// chat: foca input e envia
const inp = await p.evaluate(() => {
  const el = document.querySelector('input');
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.click(inp.x, inp.y);
await p.waitForTimeout(300);
await p.keyboard.type('ola mundo');
await p.keyboard.press('Enter');
await p.waitForTimeout(2500);
const bub = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  const c = lp?.chatBubble;
  if (!c) return { none: true };
  const img = c.list.find(o => o.type === 'Image');
  return { vis: c.visible, kids: c.list.length, tex: img?.texture?.key, w: img?.width, h: img?.height };
});
console.log('bubble:', JSON.stringify(bub));
await p.screenshot({ path: 'shots/bubble-new2.png', timeout: 120000 });
await b.close();
