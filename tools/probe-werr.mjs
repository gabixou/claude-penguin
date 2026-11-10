import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('console', m => console.log('CON', m.type(), m.text().slice(0, 200)));
p.on('pageerror', e => console.log('ERR', e.message.slice(0, 300)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(12000);
const r = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { open: w?.isOpen, cells: w?.cells?.length, dollVis: w?._dollImg?.visible, dollTex: w?._dollImg?.texture?.key };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'tools/shots/wardrobe-v3.png' });
await b.close();
