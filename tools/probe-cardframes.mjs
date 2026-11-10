import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const m = await MovieRoom.load('/assets/movies/interface');
  const sp = m.sprites['701'];
  const out = {};
  for (const fi of [0,1,2,3]) {
    const fr = sp?.frames?.[fi];
    out['frame'+fi] = fr ? fr.map(e => e.name || e.id).slice(0, 80) : null;
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
