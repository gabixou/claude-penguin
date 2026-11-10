import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(5000);
// verifica estado do loading screen sem screenshot
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  if (!s?.loadingScreen) return 'no loadingScreen';
  const ls = s.loadingScreen;
  return {
    visible: ls.visible,
    children: ls.list?.length,
    hasArrowCont: !!ls._arrowCont,
    arrowChildren: ls._arrowCont?.list?.length,
    label: ls._label?.text,
    progress: ls._progress
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
