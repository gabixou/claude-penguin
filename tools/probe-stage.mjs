import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
const st = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const m = await MovieRoom.load('/assets/catalogues/clothing');
  return { stage: m.stage, frames: m._mainTl.frames.length, rate: m.rate };
});
console.log(JSON.stringify(st));
await b.close();
