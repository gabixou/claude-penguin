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
  p.equip('head', 1187);
  // espera o clip carregar
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const art = sc.penguinArt || p.art || p._art;
    const has = art?.items?.has?.('head');
    if (has) return { ok: true, waited: i * 500 };
  }
  const art = sc.penguinArt || p.art || p._art;
  return { ok: false, keys: art ? [...(art.items?.keys?.() || [])] : 'noart', outfit: p.gpaOutfit };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/equip-1187b.png' });
await b.close();
