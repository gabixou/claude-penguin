import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });

// clica no botao shop_btn via clickTarget -> moveTo real
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const b = sc._interactions.buttons.find((x) => /shop/.test(x.path));
  const cx = (b.bounds[0] + b.bounds[2]) / 2, cy = (b.bounds[1] + b.bounds[3]) / 2;
  return { cx, cy, walk: b.walk, penguin: [sc.localPlayer.x, sc.localPlayer.y] };
});
console.log('shop btn:', JSON.stringify(r));
// simula o fluxo do pointerdown: clickTarget + moveTo
await p.evaluate(([cx, cy]) => {
  const sc = window.__penguin.scene;
  const dest = sc._interactions.clickTarget(cx, cy);
  sc.localPlayer.moveTo(dest.x, dest.y, 150, () => {
    const exit = sc.movie.triggerAt(sc.localPlayer.x, sc.localPlayer.y);
    if (exit) sc.changeRoom(exit.room, exit.x, exit.y);
  });
}, [r.cx, r.cy]);
// espera andar + trocar de sala
await p.waitForFunction(() => window.__penguin.scene.currentRoom !== 'town', null, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(1500);
console.log('room now:', await p.evaluate(() => window.__penguin.scene.currentRoom));
await b.close();
