import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const m = await MovieRoom.load('/assets/movies/interface');
  const keys = Object.keys(m.sprites).filter(k => ['584','585','680','681','674','675','596','107','672'].includes(k));
  const out = {};
  for (const k of keys) {
    const sp = m.sprites[k];
    out[k] = { frames: sp?.frames?.length, f0len: sp?.frames?.[0]?.length,
      names: sp?.frames?.[0]?.map(e=>e.name).filter(Boolean).slice(0,30) };
  }
  // tab_mc entry no frame3: matrix?
  const e = m.sprites['701'].frames[3].find(x=>x.name==='tab_mc');
  out.tabEntry = e;
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
