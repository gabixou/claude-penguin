import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
const r = await p.evaluate(`(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const movie = await MovieRoom.load('/assets/movies/furniture/130');
  const clip = new Clip(movie);
  clip.goto('item', 3, false);   // rotacao 3 = vista com luzes
  clip.goto('item.art', 1, false);
  const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
  const ID = { a:1,b:0,c:0,d:1,x:0,y:0 };
  const COL = { mult:[1,1,1,1], add:[0,0,0,0] };
  const cv = document.createElement('canvas'); cv.width=500; cv.height=500;
  const ctx = cv.getContext('2d');
  await clip._drawListFrame(ctx, frame, ID, '', COL, 2);
  const frames1 = [...clip.playheads.values()].map(v => v.frame);
  clip.advance(30);
  await clip._drawListFrame(ctx, frame, ID, '', COL, 2);
  const frames2 = [...clip.playheads.values()].map(v => v.frame);
  return { nPh: clip.playheads.size,
    uniqueStart: [...new Set(frames1)].length,
    startSample: frames1.slice(0, 15),
    after30: frames2.slice(0, 15),
    stillPlaying: [...clip.playheads.values()].filter(v=>v.playing).length };
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
