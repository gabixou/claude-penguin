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
  const fr = m.sprites['701'].frames[3];
  const out = {};
  for (const name of ['tab_mc','menu_mc_holder','sort_mc','next_btn','back_btn','tab_btn']) {
    const e = fr.find(x => x.name === name);
    if (!e) { out[name] = null; continue; }
    const b = clip._boundsOf([e], {a:1,b:0,c:0,d:1,x:0,y:0}, '');
    const sp = m.sprites[String(e.id)];
    out[name] = { id: e.id, bounds: b, frames: sp?.frames?.length,
      children: sp?.frames?.[0]?.map(c => ({n: c.name, id: c.id})).slice(0,40) };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
