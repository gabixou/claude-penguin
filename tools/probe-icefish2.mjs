import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message, '\n', (e.stack||'').split('\n').slice(0,6).join('\n')));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);

const px = () => p.evaluate(() => {
  const c = window.__penguin.scene._minigame?._native?.canvas;
  if (!c) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let nonBlack = 0, colors = new Set();
  for (let i = 0; i < d.length; i += 40) {
    if (d[i] > 30 || d[i+1] > 30 || d[i+2] > 30) { nonBlack++; colors.add((d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4)); }
  }
  return { nonBlack, distinct: colors.size };
});
console.log('menu px:', JSON.stringify(await px()));
await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent === 'PLAY')?.click());
await p.waitForTimeout(5000);
console.log('game px:', JSON.stringify(await px()));
const st = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  return {
    fishFrames: [1,2,3,4,5,6,7,8].map(i => g._frame('fish'+i)),
    hook: g._frame('hook'), mouseY: Math.round(g.model.mouseY),
    running: g.model.running, caught: g.model.fishCaught,
    err: window.__lasterr || null,
  };
});
console.log('state:', JSON.stringify(st));
await b.close();
