import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene, m = sc.movie;
  const out = {};
  for (const nm of ['nightclubsign_mc', 'nightclubsignglow_mc']) {
    const d = (sc._dynList || []).find(x => x.path.endsWith(nm));
    const h = m._playhead(d.path, d.sid);
    const fr = h.tl.frames[0] || [];
    out[nm] = fr.map(e => {
      const sid = String(e.id);
      const sp = m.sprites[sid], ch = m.characters[sid];
      return {
        id: e.id, name: e.name, depth: e.depth, matrix: e.matrix,
        sprite: !!sp, frames: sp?.frames?.length, char: ch?.kind, file: ch?.file,
      };
    });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
