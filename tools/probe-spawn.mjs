import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return {
    pos: { x: s.localPlayer.x, y: s.localPlayer.y },
    valid: s.movie?.isValidSpawn?.(s.localPlayer.x, s.localPlayer.y),
    blocked: s.movie?.hitBlock?.(s.localPlayer.x, s.localPlayer.y),
    trigger: s.movie?.triggerAt?.(s.localPlayer.x, s.localPlayer.y)
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
