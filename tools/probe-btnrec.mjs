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
  const dump = (id) => {
    const ch = m.characters[id];
    const out = { id, kind: ch.kind, size: ch.size, origin: ch.origin };
    for (const [k, rec] of Object.entries(ch.records || {})) {
      out[k] = (rec || []).map(e => ({ id: e.id, name: e.name, matrix: e.matrix, depth: e.depth }));
    }
    return out;
  };
  return { b291: dump(291), b298: dump(298) };
});
console.log(JSON.stringify(st, null, 1));
await b.close();
