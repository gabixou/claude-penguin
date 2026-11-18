import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
const r = await p.evaluate(`(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const out = {};
  for (const [id, rot] of [['132', 2], ['130', 3], ['101', 1], ['274', 1], ['154', 1], ['177', 1]]) {
    const movie = await MovieRoom.load('/assets/movies/furniture/' + id).catch(() => null);
    if (!movie) { out[id] = 'no movie'; continue; }
    const clip = new Clip(movie);
    clip.goto('item', rot, false);
    clip.goto('item.art', 1, false);
    const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
    const ID = { a:1,b:0,c:0,d:1,x:0,y:0 };
    const COL = { mult:[1,1,1,1], add:[0,0,0,0] };
    const cv = document.createElement('canvas'); cv.width=500; cv.height=500;
    const ctx = cv.getContext('2d');
    const paint = () => clip._drawListFrame(ctx, frame, ID, '', COL, 2);
    // warm + mede bounds
    const b0 = clip._boundsOf(frame, ID, '');
    let t0 = performance.now(); await paint(); const first = performance.now() - t0;
    // 10 ticks: advance + paint
    t0 = performance.now();
    for (let i = 0; i < 10; i++) { clip.advance(1); await paint(); }
    const tickAvg = (performance.now() - t0) / 10;
    const ph = [...clip.playheads.values()].map(v => v.frame + (v.playing ? 'P' : 'S'));
    out[id] = { first: +first.toFixed(1), tick: +tickAvg.toFixed(2), nPh: clip.playheads.size, sample: ph.slice(0, 8), bounds: b0 && b0.map(Math.round) };
  }
  return out;
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
