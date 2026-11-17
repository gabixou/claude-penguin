import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', m => { if (m.type() !== 'log') console.log('CON[' + m.type() + ']:', m.text().slice(0, 300)); });
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(2500);

const res = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const out = {};
  // chama renderFrame manualmente num canvas de teste e conta pixels
  const test = document.createElement('canvas');
  test.width = 760; test.height = 480;
  try {
    await g.movie.renderFrame(undefined, test, 1);
    const d = test.getContext('2d').getImageData(0, 0, 760, 480).data;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 400) colors.add((d[i] << 16) | (d[i+1] << 8) | d[i+2]);
    out.testColors = colors.size;
  } catch (e) { out.renderErr = String(e).slice(0, 300); }
  // estado interno do movie
  out.mainFrame = g.movie._mainFrame;
  out.playheads = g.movie._playheadAll?.size;
  out.sprites = Object.keys(g.movie.sprites ?? {}).length;
  out.svgCache = g.movie._svgCache?.size;
  out.imgCache = g.movie._imgCache?.size;
  out.artCache = g.movie._artCache?.size;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
