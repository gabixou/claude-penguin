import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  const inter = m.interactions || {};
  const out = { keys: Object.keys(inter) };
  for (const k of ['over', 'out', 'click', 'disabled']) {
    const v = inter[k];
    out[k] = v instanceof Map ? [...v.entries()].slice(0, 30) : (Array.isArray(v) ? v.slice(0, 30) : v);
  }
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 6000));
await b.close();
