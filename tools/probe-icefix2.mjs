import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
const r = await p.evaluate(() => {
  const n = window.__penguin.scene._minigame._native;
  const m = n.movie;
  const st = (p) => m.getState ? m.getState(p) : m._state.get(p);
  return {
    fish1hot: st('fish1.obj.hotspot'),
    hookhot: st('hook.hotspot'),
    bigfish: st('bigFish.obj.disthotspot'),
    // hit-test continua funcionando?
    poseFish: !!m.pose('fish1.obj.hotspot'),
    poseHook: !!m.pose('hook.hotspot'),
  };
});
console.log(JSON.stringify(r));
await b.close();
