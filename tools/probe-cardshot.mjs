import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForTimeout(2500);
await p.screenshot({ path: 'shots/pcard-self.png' });
// lista zonas interativas do card
const zones = await p.evaluate(() => {
  const pc = window.__penguin.scene.playerCard;
  if (!pc?.container) return 'no card';
  const out = [];
  pc.container.each((o) => { if (o.type === 'Zone') out.push({ name: o.name, x: o.x | 0, y: o.y | 0 }); });
  return out;
});
console.log(JSON.stringify(zones));
await b.close();
