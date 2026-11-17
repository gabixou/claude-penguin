import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(2500);

const stats = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  const c = g.canvas;
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const colors = new Set();
  let nonBg = 0;
  for (let i = 0; i < d.length; i += 40) { // sample
    const r = d[i], gg = d[i+1], bb = d[i+2];
    colors.add((r << 16) | (gg << 8) | bb);
    if (!(r < 60 && gg < 60 && bb < 60)) nonBg++;
  }
  return { w: c.width, h: c.height, sampled: Math.ceil(d.length / 40), distinctColors: colors.size, nonBgSamples: nonBg,
    movieFrame: g.movie._mainFrame, dirty: g.movie._dirty };
});
console.log(JSON.stringify(stats));
await p.screenshot({ path: 'tools/shots/icefish-gameplay-sw.png' });
await b.close();
