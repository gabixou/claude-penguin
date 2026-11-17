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

// 1) LINHA: pixels na coluna da linha durante gameplay normal
const linePx = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  const ctx = g.canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, g.canvas.width, g.canvas.height).data;
  // linha ~stage x=367 -> canvas ~734; varre colunas 700-770
  const cols = [];
  for (let x = 700; x <= 770; x++) {
    let dark = 0;
    for (let y = 60; y < 700; y += 2) {
      const i = (y * g.canvas.width + x) * 4;
      if (d[i] < 100 && d[i+1] < 100 && d[i+2] < 100) dark++;
    }
    cols.push({ x, dark });
  }
  cols.sort((a, b2) => b2.dark - a.dark);
  return { top: cols.slice(0, 3), lineFrame: g._frame('line') };
});
console.log('LINE-PIXELS:', JSON.stringify(linePx));

// 2) CHOQUE: força jellyHit de verdade (move jfish1 hotspot p/ hook) e verifica line voltar ao frame 1
const shock = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.level = 2; g.model.isHit = false;
  // poe jfish1 em cima do hook para garantir colisao
  const hook = g._pos('hook');
  g._moveTo('jfish1', hook[4], hook[5]);
  g.movie.goto('jfish1', 2, true);
  await sleep(600); // deixa um tick rodar _jellyHit
  const during = { lineFrame: g._frame('line'), isHit: g.model.isHit, jellyHits: g.model.jellyHits };
  // espera a animacao de 19 frames do sprite 151 (~0.8s) + margem
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    if (g._frame('line') === 1) break;
  }
  return { during, afterLineFrame: g._frame('line'), afterIsHit: g.model.isHit, penguinFrame: g._frame('penguin') };
});
console.log('SHOCK:', JSON.stringify(shock));

// 3) COLLECT COINS: game over e clica no botao
const coins = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.lives = 0; g.model.isHit = false; g.model.fishCaught = 12;
  g._gameOver();
  await sleep(500);
  const btns = g._buttons().map(b => ({ path: b.path, rel: b.release.replace(/\s+/g,' ').slice(0,60), b: b.bounds.map(v=>Math.round(v)) }));
  const collect = g._buttons().find(b => /getCoins/.test(b.release) && b.bounds[1] > 200);
  let clicked = null;
  if (collect) {
    const [x0, y0, x1, y1] = collect.bounds;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const r = g.canvas.getBoundingClientRect();
    g.canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + cx / 760 * r.width, clientY: r.top + cy / 480 * r.height, bubbles: true }));
    clicked = { cx: Math.round(cx), cy: Math.round(cy) };
    await sleep(400);
  }
  return { btns, collectFound: !!collect, clicked, destroyed: g._destroyed,
    overlayOpen: !!window.__penguin.scene._minigame?.isOpen };
});
console.log('COINS:', JSON.stringify(coins, null, 1));
await b.close();
