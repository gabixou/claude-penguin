import { chromium } from 'playwright-core';
const cat = process.argv[2] || 'clothing';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate((c) => window.__penguin.scene.openContent(c + '_catalogue'), cat);
await p.waitForTimeout(4000);
const n = await p.evaluate(() => window.__penguin.scene.catalogue.movie._mainTl.frames.length);
console.log('frames:', n);
for (let f = 0; f < n; f++) {
  await p.evaluate((f) => window.__penguin.scene.catalogue._goto(f), f);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/catlive-${cat}-p${f}.png` });
}
console.log('errors:', errs.length ? errs : 'none');
await b.close();
