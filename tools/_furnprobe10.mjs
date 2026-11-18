import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
const r = await p.evaluate(`(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const movie = await MovieRoom.load('/assets/movies/furniture/130');
  const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
  const itemE = frame.find((e) => e.name === 'item') || frame[0];
  const itemSp = movie.sprites[String(itemE.id)];
  const f1 = itemSp.frames[0];
  return {
    itemSprite: itemE.id, itemFrames: itemSp.frames.length,
    frame1: f1.map((e) => ({ name: e.name, id: e.id, sub: movie.sprites[String(e.id)]?.frames?.length })),
  };
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
