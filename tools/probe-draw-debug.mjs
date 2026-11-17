import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON:', m.text().slice(0, 250)); });
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  const m = g.movie;
  window.__dbg = { shapes: 0, nullCanvas: 0, entries: 0, skipped: 0, invisible: 0 };
  const os = m._drawShape.bind(m);
  m._drawShape = async (ctx, ch, world, color, scale, file) => {
    window.__dbg.shapes++;
    const c = await m.artCanvas(file ?? ch.file, ch, scale);
    if (!c) window.__dbg.nullCanvas++;
    return os(ctx, ch, world, color, scale, file);
  };
  const oe = m._drawEntries.bind(m);
  m._drawEntries = async (ctx, entries, matrix, path, color, scale, depth) => {
    window.__dbg.entries += entries.length;
    return oe(ctx, entries, matrix, path, color, scale, depth);
  };
  g._onPlay();
});
await p.waitForTimeout(3000);
const dbg = await p.evaluate(() => window.__dbg);
console.log(JSON.stringify(dbg));
await b.close();
