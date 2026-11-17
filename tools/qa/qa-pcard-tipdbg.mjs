import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', (m) => console.log('CON', m.type(), m.text().slice(0, 200)));
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.playerCard.isOpen === true, null, { timeout: 30000 });
await p.waitForTimeout(1500);
// chama show() direto com try/catch para ver erros
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const card = s.playerCard.container;
  const zone = card?.list?.find((o) => o.name === 'pcard_rename');
  const tip = s.playerCard._tooltip;
  if (!zone || !tip) return { zone: !!zone, tip: !!tip };
  const wb = zone.getBounds();
  // converte p/ coords locais do container: container tem posicao cx-dw/2
  const cont = card;
  // bounds locais do zone: zone.x/y sao coords do container
  try {
    await tip.show(zone.x - zone.width / 2, zone.y - zone.height / 2, zone.width, zone.height, 'Rename penguin');
    return { ok: true, img: !!tip.image, tex: tip.image?.texture?.key };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 500) }; }
});
console.log('direct show:', JSON.stringify(r));
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/pcard-tooltip2.png' });
await b.close();
