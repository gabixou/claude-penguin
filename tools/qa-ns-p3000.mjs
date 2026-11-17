import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  const frame = movie.sprites['5'].frames[0];
  const ch = movie.characters['4'];
  const p = movie._boundsOfEntries(frame, { a:1,b:0,c:0,d:1,x:0,y:0 }, 'dbg');
  // svg image status
  const imgP = movie._svgImage ? 'has _svgImage' : 'no';
  let svgOk = null;
  try { const img = await movie._svgImage(ch.file); svgOk = img ? { w: img.naturalWidth, h: img.naturalHeight } : null; } catch(e) { svgOk = 'ERR ' + e.message; }
  return { p, chSize: ch.size, chOrigin: ch.origin, file: ch.file, svgOk, imgP };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
