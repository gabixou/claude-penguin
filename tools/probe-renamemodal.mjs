import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', m => { if (m.type() === 'error') console.log('CONS', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  await scene.playerCard.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 2000));
  let zone = null;
  scene.playerCard.container.each((o) => { if (o.name === 'pcard_rename') zone = o; });
  if (!zone) return { ok: false, reason: 'no rename zone' };
  zone.emit('pointerdown');
  // open() e async agora — espera o modal construir
  for (let i = 0; i < 40 && !scene.nameChangeModal.isOpen; i++) await new Promise(r => setTimeout(r, 250));
  return { ok: scene.nameChangeModal.isOpen, canRename: scene.network?.canRename };
});
console.log(JSON.stringify(r));
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/rename-modal2.png' });
// checa input DOM visivel e posicionado
const inp = await p.evaluate(() => {
  const el = document.querySelector('input:not(.cp-chat-input)');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { display: getComputedStyle(el).display, x: r.x | 0, y: r.y | 0, w: r.width | 0, h: r.height | 0, font: getComputedStyle(el).fontFamily.slice(0, 40) };
});
console.log('input:', JSON.stringify(inp));
await b.close();
