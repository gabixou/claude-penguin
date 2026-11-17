import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1200);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(800);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(6000);
const res = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  const ctx = g.canvas.getContext('2d');
  const W = g.canvas.width;
  const d = ctx.getImageData(0, 0, W, g.canvas.height).data;
  // coluna da linha: pose('line').matrix.x * 2 (canvas 2x)
  const pose = g.movie.pose('line');
  const cx = Math.round(pose.matrix.x * 2);
  // varre x em +-6 e mede extent vertical de pixels cinza #666
  let best = null;
  for (let x = cx - 6; x <= cx + 6; x++) {
    let y0 = -1, y1 = -1, n = 0;
    for (let y = 0; y < g.canvas.height; y++) {
      const i = (y * W + x) * 4;
      const r = d[i], gg = d[i+1], bl = d[i+2];
      if (Math.abs(r-gg)<15 && Math.abs(gg-bl)<15 && r>70 && r<150) { if(y0<0)y0=y; y1=y; n++; }
    }
    if (!best || n > best.n) best = { x, y0, y1, n };
  }
  const hook = g.movie.pose('hook');
  return { lineX: cx, best, hookY: hook ? Math.round(hook.matrix.y*2) : null, lineFrame: g._frame('line') };
});
console.log(JSON.stringify(res));
await b.close();
