import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  try {
    await sc.playerCard.open(sc.localPlayer);
    await new Promise(r => setTimeout(r, 3000));
    return { open: sc.playerCard.isOpen, lp: !!sc.localPlayer, cont: !!sc.playerCard.container };
  } catch (e) { return { err: String(e), stack: (e.stack||'').slice(0,400) }; }
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/card-photo.png' });
await b.close();
