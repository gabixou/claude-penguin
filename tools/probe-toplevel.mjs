import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  const main = m._mainTl.frames[0] || [];
  return main.map((e, i) => ({
    i, id: e.id, name: e.name || '', depth: e.depth,
    z: m._depthOf(e),
    spriteFrames: m.sprites[String(e.id)]?.frames?.length,
    char: m.characters[String(e.id)]?.kind,
  }));
});
console.log(JSON.stringify(r, null, 0));
await b.close();
