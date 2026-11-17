import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForTimeout(4000);

const cov = await p.evaluate(() => {
  const el = document.elementFromPoint(760, 480);
  const g = window.__penguin.scene.game;
  return {
    topEl: el ? el.tagName + '.' + (el.className || '').toString().slice(0, 40) : 'none',
    loopRunning: g.loop.running,
    overlayRect: document.querySelector('iframe')?.getBoundingClientRect().toJSON(),
    overlayBg: getComputedStyle(document.querySelector('iframe')?.parentElement?.parentElement || document.body).backgroundColor,
  };
});
console.log('cobertura:', JSON.stringify(cov));

// fps dentro do iframe do jogo
const fps = await p.evaluate(() => new Promise(res => {
  const f = document.querySelector('iframe');
  const w = f.contentWindow;
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 2000) w.requestAnimationFrame(tick); else res(n / 2); };
  w.requestAnimationFrame(tick);
}));
console.log('fps iframe:', fps);

// pixels: canvas do phaser ainda visivel? amostra cantos
const corners = await p.evaluate(() => {
  const c = window.__penguin.scene.game.canvas;
  const d = c.getContext('2d').getImageData(0, 0, 4, 4).data;
  return Array.from(d.slice(0, 12));
});
console.log('phaser canvas canto:', corners);
await b.close();
