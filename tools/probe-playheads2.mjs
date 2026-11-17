import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?._warmDone === true, null, { timeout: 60000 });

// anda DEVAGAR (moveTo com speed baixo) e amostra playheads no meio do walk
await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  lp.moveTo(lp.x + 200, lp.y, 60); // ~3.3s de walk
});
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const v = window.__penguin.scene.localPlayer.view;
  const dump = (clip, tag) => {
    const phs = [...(clip.playheads?.values() || [])];
    return { tag, n: phs.length,
      list: phs.map(h => `${String(h.path).slice(-30)}@${(h.timeline?.frames?.length ?? '?')}f:${h.frame}${h.playing ? 'P' : 's'}`).slice(0, 60) };
  };
  return { action: window.__penguin.scene.localPlayer.action,
           frame: v.frame, af: v.animationFrame, drawn: v.drawnFrame,
           art: dump(v.art, 'art'),
           items: [...v.items.entries()].map(([s, c]) => dump(c, s)) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
