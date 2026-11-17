import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
for (let i = 0; i < 6; i++) {
  const r = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const m = sc.movie;
    const res = {};
    for (const d of (sc._dynList || [])) {
      const ph = m._playheads?.[d.path] || m._playheadAll?.get?.(d.path + ':' + (d.spriteId ?? ''));
      res[d.path.split('.').pop()] = { frames: d.frames ?? d.entry?.frames?.length ?? d.timeline?.length, cur: ph?.frame ?? ph?._frame ?? ph?.currentFrame };
    }
    res._dirtyPaths = [...(m._dirtyPaths || [])].slice(0, 10);
    return res;
  });
  console.log(i, JSON.stringify(r));
  await p.waitForTimeout(700);
}
await b.close();
