import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => { window.__penguin.scene.changeRoom('pet'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 400));
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const ba = s._interactions.buttonAt(690,245);
  const ct = s._interactions.clickTarget(690,245);
  const all = s._interactions.buttons.filter(b => { const [x0,y0,x1,y1]=b.bounds; return 690>=x0&&690<=x1&&245>=y0&&245<=y1; }).map(b=>({p:b.path,b:b.bounds,w:b.walk,g:b.game,c:b.content}));
  return { ba: ba?.path, ct, all };
});
console.log(JSON.stringify(r));
await b.close();
