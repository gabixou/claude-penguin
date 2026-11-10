import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('console:', m.text().slice(0,200)); });
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady !== false && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.waitForTimeout(1500);
const info = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const btns = (sc._interactions?.buttons || []).map(b => ({ path: b.path, name: b.name, content: b.content, game: b.game, disabled: b.disabled, bounds: b.bounds }));
  const trigs = (sc.movie?._triggers || []).map(t => ({ name: t.name, content: t.content, room: t.room }));
  const ci = sc.movie?.interactions;
  return { room: sc.currentRoom, btns, trigs, click: ci?.click, trigContent: ci?.trigContent, trigGame: ci?.trigGame };
});
console.log(JSON.stringify(info, null, 1));
// testa openContent direto
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForTimeout(4000);
const cat = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  return { open: !!sc.catalogue?.isOpen, key: sc.catalogue?.key, loading: !!sc.loadingScreen?.visible };
});
console.log('apos openContent:', JSON.stringify(cat));
await p.screenshot({ path: 'shots/shop-cat.png' });
await b.close();
