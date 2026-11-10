import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  return { ctor: s.movie?.constructor?.name, hasLoad: typeof s.movie?.constructor?.load };
});
console.log(JSON.stringify(r));
await b.close();
