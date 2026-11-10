import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const texts = [];
  const walk = (parent) => {
    const kids = parent?.list || parent?.children?.list;
    if (!kids) return;
    for (const ch of kids) {
      if (ch?.type === 'Text') texts.push({ str: (ch.text||'').slice(0,25), res: ch.style?.resolution, fs: ch.style?.fontSize });
      if (ch?.list || ch?.children?.list) walk(ch);
    }
  };
  walk(sc.children);
  return texts;
});
console.log(JSON.stringify(r));
await b.close();
