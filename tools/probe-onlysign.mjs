import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  for (const s of (sc.movieLayers || [])) s.img?.setVisible(false);
  for (const d of (sc._dynList || [])) {
    const keep = d.path.endsWith('nightclubsign_mc') || d.path.endsWith('nightclubsignglow_mc');
    d.img?.setVisible(!!keep);
  }
  return 'ok';
});
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/town-onlysign.png' });
console.log(r);
await b.close();
