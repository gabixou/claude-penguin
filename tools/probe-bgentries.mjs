import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  // acha bitmapbg_mc no main timeline e lista seus filhos (frame 1 do sprite)
  const main = m._mainTl.frames[0] || [];
  const find = (entries, pred, path, out) => {
    for (const e of entries) {
      const cp = m._path(path, e);
      if (pred(e, cp)) out.push({ path: cp, id: e.id, name: e.name, depth: e.depth });
      const sid = String(e.id);
      if (m.sprites[sid]) {
        const h = m._playheads.get(cp) || [...(m._playheads?.values()||[])].find(v=>v.path===cp);
        const fr = h ? (h.tl.frames[h.frame-1]||[]) : (m.sprites[sid].frames?.[0]||[]);
        find(fr, pred, cp, out);
      }
    }
  };
  const hits = [];
  find(main, (e, cp) => /nightclub|sign|star|disco|glow/i.test(cp), '', hits);
  return hits;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
