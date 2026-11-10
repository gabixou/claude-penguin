import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const m = s.movie;
  return {
    hasIsValid: typeof m?.isValidSpawn,
    hasFindSafe: typeof m?.findSafeSpawn,
    valid: m?.isValidSpawn?.(380, 312),
    safe: m?.findSafeSpawn?.(20, 20)
  };
});
console.log(JSON.stringify(r));
await b.close();
