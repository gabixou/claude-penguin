import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.handleAction('dance'));
await p.waitForTimeout(5000);
const st = await p.evaluate(async () => {
  const lp = window.__penguin.scene.localPlayer;
  const v = lp.view;
  const af = v.animationFrame;
  const art = v.art, clips = [art, ...v.items.values()];
  const perClip = clips.map(c => {
    const m = c.m;
    const len = m.data?.main?.frames?.length || 1;
    const f = Math.max(1, Math.min(len, Math.round(af) || 1));
    // reconta files do frame
    const files = m._ffCache?.get(f) || m._frameFiles([f]).files;
    let cached = 0, ready = 0, missing = [];
    for (const file of files) {
      if (m._imgCache?.has(file)) cached++;
      if (m._imgReady?.has(file)) ready++;
      else if (missing.length < 5) missing.push(file);
    }
    return { frames: len, af, f, total: files.size, cached, ready, sampleMissing: missing,
      imgReadySize: m._imgReady?.size, imgCacheSize: m._imgCache?.size };
  });
  return {
    af, frameReady: v.frameReady(), drawn: v.drawnFrame, items: v.items.size,
    decodeHold: (await import('/src/movie/movie.js').catch(() => null), undefined),
    perClip
  };
});
console.log(JSON.stringify(st, null, 1));
await b.close();
