import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/assets/../src/movie/movie.js').catch(()=>({}));
  return 'x';
});
// movie.js nao e servivel em preview — usar a instancia do playerCard
const r2 = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const movie = await scene.playerCard._movie();
  const { Clip } = await import('/src/movie/clip.js').catch(e => ({err:String(e)}));
  return { hasClip: !!Clip };
});
console.log(JSON.stringify(r2));
await b.close();
