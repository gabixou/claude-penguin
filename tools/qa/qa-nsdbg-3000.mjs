import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error') console.log('CERR', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  if (!movie) return { err: 'no movie' };
  await movie.ensureFonts?.();
  // sprite 5, identity local
  const sid = '5', grid = movie.scalingGrids[sid], frame = movie.sprites[sid].frames[0];
  const world = { a: 2, b: 0, c: 0, d: 2, x: 100, y: 100 };
  const local = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  const c = document.createElement('canvas'); c.width = 700; c.height = 700;
  const x = c.getContext('2d');
  await movie._drawNineSlice(x, frame, world, 'dbg', { mult: [1,1,1,1], add: [0,0,0,0] }, 2, 1, grid, local);
  // conta pixels nao-transparentes
  const d = x.getImageData(0, 0, 700, 700).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return { painted: n, png: c.toDataURL('image/png').length };
});
console.log(JSON.stringify(r));
await b.close();
