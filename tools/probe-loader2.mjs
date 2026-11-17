import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
// screenshot imediato (loading screen deve estar visível)
await p.waitForTimeout(2000);
await p.screenshot({ path: 'tools/shots/loader-vector.png' });
// verifica se loading screen existe
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return { hasLoader: !!s?.loadingScreen, loaderVisible: s?.loadingScreen?.visible };
});
console.log(JSON.stringify(r));
await b.close();
