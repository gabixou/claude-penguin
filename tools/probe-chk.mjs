import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(3500);
const st = await p.evaluate(async () => {
  const w = window.__penguin.scene.buddyWindow;
  if (!w._ready) await new Promise(r => setTimeout(r, 3000));
  w.open(); await new Promise(r => setTimeout(r, 800));
  return { dw: w.img.displayWidth, dh: w.img.displayHeight, x: w.img.x, y: w.img.y, vis: w.container.visible, title: w.titleText?.text };
});
console.log(JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/buddy-window3.png' });
await b.close();
