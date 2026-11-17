import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
const svg = await p.evaluate(() => {
  const m = window.__penguin.scene._minigame._native.movie;
  return m._svgText('7.svg');
});
writeFileSync('tools/shots/sample-7.svg', svg);
console.log(svg);
await b.close();
