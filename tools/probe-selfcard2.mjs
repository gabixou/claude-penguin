import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForTimeout(9000);
await p.screenshot({ path: 'tools/shots/pcard-self2.png' });
const r = await p.evaluate(() => {
  const pc = window.__penguin.scene.playerCard;
  return { zones: pc.container.list.filter(k => k.type === 'Zone').map(z => z.name || 'unnamed') };
});
console.log(JSON.stringify(r));
await b.close();
