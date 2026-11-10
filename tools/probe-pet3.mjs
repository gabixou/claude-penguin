import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => { window.__penguin.scene.changeRoom('pet'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 400));
const r = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const pts = [[682,247],[690,245],[685,250],[680,245],[675,245],[670,245],[665,245],[660,245],[655,245],[650,245],[645,245],[640,245],[690,240],[690,250],[695,245],[700,245]];
  return pts.map(([x,y]) => [x,y,m.triggerAt(x,y)?.game||m.triggerAt(x,y)?.room||null, m.hitBlock(x,y)?'B':'-']);
});
console.log(JSON.stringify(r));
await b.close();
