import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);
await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent === 'PLAY')?.click());

// loop de "jogador": a cada 100ms mira no peixe mais proximo do hook e clica quando alinhado
const result = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame?._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const hookX = 367;
  for (let i = 0; i < 600; i++) { // ~60s
    const m = g.model;
    if (!m.running) break;
    const hookF = g._frame('hook');
    if (hookF === 5 || hookF === 7) {
      // peixe no anzol: recolhe acima do gelo e armazena
      g.model.mouseY = 100;
      await sleep(400);
      g._fishDrop(); g._newWorm(0);
      await sleep(300);
      continue;
    }
    // peixe ativo mais proximo do hook em x
    let best = null;
    for (let n = 1; n <= 8; n++) {
      if (g._frame('fish' + n) <= 1) continue;
      const hb = g._box(`fish${n}.obj.hotspot`);
      if (!hb) continue;
      const cx = (hb[0] + hb[2]) / 2, cy = (hb[1] + hb[3]) / 2;
      const dist = Math.abs(cx - hookX);
      if (!best || dist < best.dist) best = { dist, cy, n };
    }
    if (best && best.dist < 60) {
      g.model.mouseY = best.cy;
      if (best.dist < 30) {
        g._fishDrop(); g._newWorm(0);
      }
    }
    await sleep(100);
  }
  const m = g.model;
  return { running: m.running, over: m.over, caught: m.fishCaught, orange: m.orangeFish, lives: m.lives, level: m.level, jelly: m.jellyHits, lineCuts: m.lineCuts, won: m.won, coins: g._coins() };
});
console.log('resultado:', JSON.stringify(result));
await p.screenshot({ path: 'tools/shots/icefish-caught.png' });
await b.close();
