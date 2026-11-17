import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(8000);
await p.screenshot({ path: 'tools/tools/shots/icefish-now.png' });
const map = await p.evaluate(() => new Promise(res => {
  const n = window.__penguin.scene._minigame._native;
  const c = n.canvas, x = c.getContext('2d');
  const W = 100, H = 50, out = [];
  const chars = ' .:-=+*#%@';
  for (let j = 0; j < H; j++) {
    let row = '';
    for (let i = 0; i < W; i++) {
      const d = x.getImageData((i / W) * c.width, (j / H) * c.height, 2, 2).data;
      const lum = (d[0] * 0.3 + d[1] * 0.6 + d[2] * 0.1) / 255;
      row += chars[Math.min(9, Math.floor(lum * 10))];
    }
    out.push(row);
  }
  res(out.join('\n'));
}));
console.log(map);
await b.close();
