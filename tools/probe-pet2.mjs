import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => { window.__penguin.scene.changeRoom('pet'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 500));
const r = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const lp = s.localPlayer;
  return {
    pos: [lp.x, lp.y],
    path: m.findPath(lp.x, lp.y, 690, 245),
    trig690: m.triggerAt(690, 245),
    block690: m.hitBlock(690, 245),
    valid690: m.isValidSpawn(690, 245),
    trigBtn: (() => { const b = s._interactions.buttons.find(b=>/roundup/.test(b.path)); return m.triggerAt(b.walk[0], b.walk[1]); })(),
  };
});
console.log(JSON.stringify(r));
await b.close();
