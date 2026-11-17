import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  const out = {};
  for (const [path, h] of (m._playheads || new Map()).entries()) {
    if (!/nightclubsign|giftshopsign|coffeeshop_mc$/.test(path)) continue;
    if (!h.tl?.frames) continue;
    const ss = 1.75;
    const sm = { a: ss, b: 0, c: 0, d: ss, x: 0, y: 0 };
    // worldDev aproximado: usa o dyn correspondente se existir
    const dyn = (window.__penguin.scene._dynList || []).find(d => d.path === path);
    const worldDev = dyn ? { a: ss * dyn.world.a, b: ss * dyn.world.b, c: ss * dyn.world.c, d: ss * dyn.world.d, x: ss * dyn.world.x, y: ss * dyn.world.y } : sm;
    out[path.split('.').pop()] = h.tl.frames.map((fr, i) => {
      const bb = m._boundsOfEntries(fr, worldDev, path);
      return { f: i + 1, n: fr.length, bb: bb ? bb.map(v => Math.round(v)) : null };
    });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
