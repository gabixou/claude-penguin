import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const pc = sc.playerCard;
  try {
    const movie = await pc._movie();
    const sp = movie && movie.sprites['701'];
    const info = { movie: !!movie, sp: !!sp, frames: sp?.frames?.length };
    // chama _build direto para capturar erro
    await pc._build(movie, sc.localPlayer);
    await new Promise(r => setTimeout(r, 3000));
    return { ...info, open: pc.isOpen, cont: !!pc.container };
  } catch (e) { return { err: String(e), stack: (e.stack || '').slice(0, 500) }; }
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/card-photo.png' });
await b.close();
