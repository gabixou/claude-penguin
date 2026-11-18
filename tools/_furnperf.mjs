import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
const r = await p.evaluate(`(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const movie = await MovieRoom.load('/assets/movies/furniture/132');
  const clip = new Clip(movie);
  clip.goto('item', 2, false);
  clip.goto('item.art', 1, false);
  const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
  const ID = { a:1,b:0,c:0,d:1,x:0,y:0 };
  const COL = { mult:[1,1,1,1], add:[0,0,0,0] };
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300;
  const ctx = cv.getContext('2d');
  // playheads criados no primeiro draw
  let t0 = performance.now();
  await clip._drawListFrame(ctx, frame, ID, '', COL, 2);
  const first = performance.now() - t0;
  const phs = [...clip.playheads.entries()].map(([k,v]) => k + ':' + v.frame + (v.playing ? 'P' : 'S'));
  // advance + redraw (frame animado)
  t0 = performance.now();
  clip.advance(1);
  await clip._drawListFrame(ctx, frame, ID, '', COL, 2);
  const tick = performance.now() - t0;
  return { first: +first.toFixed(1), tick: +tick.toFixed(1), playheads: phs.slice(0, 30), nPh: phs.length };
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
