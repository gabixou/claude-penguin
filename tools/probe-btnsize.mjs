import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
const st = await p.evaluate(() => {
  const m = window.__penguin.scene.catalogue.movie;
  const out = {};
  for (const id of [289,290,292,293,294,295,296,297]) {
    const ch = m.characters[id];
    out[id] = ch ? { kind: ch.kind, file: ch.file, size: ch.size, origin: ch.origin, bounds: ch.bounds } : null;
  }
  return out;
});
console.log(JSON.stringify(st, null, 1));
await b.close();
