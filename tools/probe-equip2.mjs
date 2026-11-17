import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('con:', m.text().slice(0,180)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const p = sc.localPlayer;
  const art = p.view?.art;
  p.equip('head', 1187);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (art?.items?.has?.('head')) return { ok: true, waited: i * 500, look: art.look };
  }
  return { ok: false, look: art?.look, outfit: p.gpaOutfit };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/equip-1187c.png' });
await b.close();
