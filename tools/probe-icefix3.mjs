import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.evaluate(() => { const n = window.__penguin.scene._minigame._native; n._onPlay && n._onPlay(); });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const n = window.__penguin.scene._minigame._native;
  const m = n.movie;
  const out = { frame: m._mainFrame, started: n.started ?? n._started };
  for (const path of ['fish1.obj.hotspot','fish5.obj.hotspot','hook.hotspot','sharkLeft.hotspot','crab1.obj.hotspot','oneup.obj.hotspot','bigFish.obj.hotspot']) {
    const pose = m.pose(path);
    out[path] = pose ? { f: pose.frame, b: pose.bounds } : null;
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
