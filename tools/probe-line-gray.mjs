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
await p.waitForTimeout(1500);
const res = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  const ctx = g.canvas.getContext('2d');
  const W = g.canvas.width, H = g.canvas.height;
  const d = ctx.getImageData(0, 0, W, H).data;
  // procura pixels cinza-escuros (#666 = 102) em faixa vertical
  const hits = {};
  for (let y = 80; y < 800; y++) {
    for (let x = 600; x < 900; x++) {
      const i = (y * W + x) * 4;
      const r = d[i], gg = d[i+1], bl = d[i+2];
      if (Math.abs(r-gg)<12 && Math.abs(gg-bl)<12 && r>70 && r<140) {
        hits[x] = (hits[x]||0)+1;
      }
    }
  }
  const cols = Object.entries(hits).sort((a,b)=>b[1]-a[1]).slice(0,8);
  // posicao esperada da linha: pose('line')
  const pose = g.movie.pose('line');
  return { cols, linePose: pose ? {frame: pose.frame, matrix: JSON.stringify(pose.matrix)} : null, lineFrame: g._frame('line') };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
