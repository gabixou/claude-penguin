import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const hid = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const seg = (sc.movieLayers || []).find(s => [...(s.paths||[])].some(pp => pp.endsWith('bitmapbg_mc#50')));
  if (seg?.img) { seg.img.setVisible(false); return { depth: seg.depth, paths: [...seg.paths].slice(0,4) }; }
  return null;
});
console.log('hidden:', JSON.stringify(hid));
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/town-noseg600.png' });
await b.close();
console.log('done');
