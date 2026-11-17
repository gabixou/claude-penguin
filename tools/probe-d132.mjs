import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
// esconde tudo menos #132
await p.evaluate(() => {
  const sc = window.__penguin.scene;
  for (const s of (sc.movieLayers || [])) s.img?.setVisible(false);
  for (const d of (sc._dynList || [])) d.img?.setVisible(d.path === '#132');
});
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/town-only132.png' });
// estrutura do frame atual do #132
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene, m = sc.movie;
  const d = (sc._dynList || []).find(x => x.path === '#132');
  const h = d ? m._playhead(d.path, d.sid) : null;
  if (!h) return { err: 'no h' };
  const fr = h.tl.frames[h.frame - 1] || [];
  const walk = (entries, path, depth, out) => {
    for (const e of entries) {
      const cp = m._path(path, e);
      out.push('  '.repeat(depth) + cp + ' id=' + e.id + ' d=' + e.depth);
      const sid = String(e.id);
      if (m.sprites[sid]) {
        const hh = m._playheads.get(cp);
        const fr2 = hh ? (hh.tl.frames[hh.frame - 1] || []) : (m.sprites[sid].frames?.[0] || []);
        walk(fr2, cp, depth + 1, out);
      }
    }
  };
  const out = ['frame=' + h.frame + '/' + h.tl.frames.length];
  walk(fr, '', 0, out);
  return out.slice(0, 60);
});
console.log(r.join('\n'));
await b.close();
