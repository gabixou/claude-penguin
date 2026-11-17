import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?._warmDone === true, null, { timeout: 60000 });

// anda e observa playheads: quantos, frames, playing?
await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  lp.moveTo(lp.x + 300, lp.y, 300);
});
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const v = window.__penguin.scene.localPlayer.view;
  const dump = (clip, tag) => {
    const phs = [...(clip.playheads?.values() || [])];
    return {
      tag, n: phs.length,
      playing: phs.filter(h => h.playing).length,
      frames: phs.map(h => `${String(h.path).split('.').pop()}@${(h.timeline?.frames?.length ?? '?')}f:${h.frame}${h.playing ? 'p' : 's'}`).slice(0, 40),
    };
  };
  return { art: dump(v.art, 'art'), items: [...v.items.values()].map((c, i) => dump(c, 'item' + i)) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
