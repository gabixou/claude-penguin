import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const out = {};
  for (const cat of ['clothing','cove','dance','sport','costume','pets']) {
    const m = await MovieRoom.load('/assets/catalogues/' + cat);
    const stats = [];
    const n = m._mainTl.frames.length;
    for (let f = 0; f < n; f++) {
      const c = document.createElement('canvas'); c.width = 380; c.height = 240;
      await m.renderFrame(f, c, 0.5);
      const d = c.getContext('2d').getImageData(0,0,380,240).data;
      let nonWhite = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (!(d[i] > 245 && d[i+1] > 245 && d[i+2] > 245)) nonWhite++;
      }
      stats.push(nonWhite);
    }
    out[cat] = { frames: n, nonWhite: stats };
  }
  return out;
});
console.log(JSON.stringify(r));
await b.close();
