import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe', headless: true });
const p = await b.newPage();
p.on('console', m => console.log('[pg]', m.type(), m.text().slice(0, 200)));
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const out = {};
  for (const pack of ['/assets/movies/igloo', '/assets/movies/igloo-type/1', '/assets/movies/igloo-type/15']) {
    try {
      const movie = await MovieRoom.load(pack);
      const clip = new Clip(movie);
      const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
      // desenha frame 0 num canvas e conta pixels nao-transparentes
      const ss = 1;
      const cv = document.createElement('canvas');
      cv.width = 760; cv.height = 480;
      const ctx = cv.getContext('2d');
      const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
      const COL = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
      const t0 = performance.now();
      await clip._drawListFrame(ctx, frame, ID, '', COL, 2);
      const img = ctx.getImageData(0, 0, 760, 480).data;
      let painted = 0;
      for (let i = 3; i < img.length; i += 4) if (img[i] > 10) painted++;
      out[pack] = { entries: frame.length, painted, ms: Math.round(performance.now() - t0), sprites: Object.keys(movie.sprites || {}).length };
    } catch (e) {
      out[pack] = { error: String(e).slice(0, 300) };
    }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
