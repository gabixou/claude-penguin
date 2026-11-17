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
for (let i = 0; i < 4; i++) {
  await p.waitForTimeout(3500);
  await p.screenshot({ path: 'tools/tools/shots/icef' + i + '.png' });
  const st = await p.evaluate(() => {
    const n = window.__penguin.scene._minigame._native;
    return { fish: n.model.fishCaught, level: n.model.level, running: n.model.running };
  });
  console.log(i, JSON.stringify(st));
}
await b.close();
