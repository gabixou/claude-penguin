import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const m = await MovieRoom.load('/assets/movies/interface');
  const clip = new Clip(m);
  const IDENT = {a:1,b:0,c:0,d:1,x:0,y:0};
  const dump = (sid, depth=0, out=[]) => {
    const sp = m.sprites[String(sid)];
    const fr = sp?.frames?.[0];
    if (!fr) return out;
    for (const e of fr) {
      const b = clip._boundsOf([e], IDENT, '');
      out.push({ d: depth, id: e.id, n: e.name, kind: e.kind, b });
      if (depth < 2 && e.id) dump(e.id, depth+1, out);
    }
    return out;
  };
  return { s584: dump(584).slice(0, 60), s680sort: dump(680).slice(0,10) };
});
console.log(JSON.stringify(r, null, 1).slice(0, 8000));
await b.close();
