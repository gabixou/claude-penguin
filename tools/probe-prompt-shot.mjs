import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const cat = sc.catalogue;
  cat._confirm({ name: 'Blue Hat', cost: 20, onYes: () => {} });
  await new Promise(r => setTimeout(r, 2000));
  return { promptOpen: cat.promptOpen, hasPrompt: !!cat._prompt };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/prompt-distort.png' });
await b.close();
