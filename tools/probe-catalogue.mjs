import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
// vai pra shop e abre o catalogo via openContent direto (testa o viewer)
await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.currentRoom === 'shop' && sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 120000 });
await p.waitForTimeout(2000); // buildCollision delayed 1.5s
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(1000);
const info = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  return {
    key: c.key, page: c.page, frames: c.movie._mainTl.frames.length,
    buttons: c.buttons.map((b) => ({ path: b.path, id: b.id, name: b.name, bounds: b.bounds.map(Math.round), rel: (b.act?.release || '').replace(/\s+/g, ' ').slice(0, 80) })),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 4000));
await p.screenshot({ path: 'tools/shots/clone-catalogue.png' });
await b.close();
