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
await p.waitForTimeout(1000);

for (let s = 0; s < 6; s++) {
  const st = await p.evaluate(() => {
    const g = window.__penguin.scene._minigame?._native;
    const m = g.model;
    const fish = [];
    for (let i = 1; i <= 8; i++) {
      const f = g._frame('fish' + i);
      if (f > 1) {
        const hb = g._box(`fish${i}.obj.hotspot`);
        fish.push(`f${i}@${f}:${hb ? hb.map(v => Math.round(v)).join(',') : 'nobox'}`);
      }
    }
    return {
      t: Math.round(m.ticks / 24), group: m.group, speed: m.speed,
      hook: g._pos('hook').slice(4).map(v => Math.round(v)),
      hookBox: g._box('hook.hotspot')?.map(v => Math.round(v)),
      fish, caught: m.fishCaught,
    };
  });
  console.log(JSON.stringify(st));
  await p.waitForTimeout(2000);
}
await b.close();
