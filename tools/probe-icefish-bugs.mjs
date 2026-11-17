import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(1000);

// 1) estado do playhead 'line' e pose
const lineState = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  return {
    lineFrame: g._frame('line'),
    linePose: g.movie.pose('line') && { frame: g.movie.pose('line').frame, id: g.movie.pose('line').id },
    entered: g.movie._entered ? [...g.movie._entered.entries()].filter(([k]) => k.includes('line')) : null,
    playheads: [...g.movie._playheads.keys()].filter(k => /line|penguin|puffle/.test(k)),
  };
});
console.log('LINE:', JSON.stringify(lineState));

// 2) forca jellyHit e observa penguin frames por 2s
const jelly = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.level = 2; g.model.isHit = false;
  // posiciona jfish1 hotspot em cima do hook para garantir hit
  g._jellyHit();
  const frames = [];
  for (let i = 0; i < 50; i++) { frames.push(g._frame('penguin')); await sleep(50); }
  return { isHit: g.model.isHit, penguinFrames: [...new Set(frames)], lineFrame: g._frame('line'), last: frames.slice(-5) };
});
console.log('JELLY:', JSON.stringify(jelly));

// 3) game over + botoes
const over = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.lives = 0;
  g._gameOver();
  await sleep(800);
  const btns = g._buttons().map(b => ({ path: b.path, rel: b.release.replace(/\s+/g, ' ').slice(0, 80), bounds: b.bounds.map(v => Math.round(v)) }));
  return { over: g.model.over, running: g.model.running, buttons: btns };
});
console.log('GAMEOVER:', JSON.stringify(over, null, 1));

// clica no centro do botao collect coins se existir
const click = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const btn = g._buttons().find(b => /getCoins|sendGameOver/.test(b.release));
  if (!btn) return { found: false };
  const [x0, y0, x1, y1] = btn.bounds;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // simula mousedown no canvas
  const r = g.canvas.getBoundingClientRect();
  const evt = new MouseEvent('mousedown', { clientX: r.left + cx / 760 * r.width, clientY: r.top + cy / 480 * r.height, bubbles: true });
  g.canvas.dispatchEvent(evt);
  await sleep(300);
  return { found: true, bounds: btn.bounds, destroyed: g._destroyed, nativeGone: !window.__penguin.scene._minigame._native };
});
console.log('CLICK:', JSON.stringify(click));
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({
  minigameOpen: !!window.__penguin.scene._minigame?.isOpen,
  native: !!window.__penguin.scene._minigame?._native,
}));
console.log('AFTER:', JSON.stringify(after));
await b.close();
