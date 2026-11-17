import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/minigames/beancounters/index.html', { waitUntil: 'load' });
await p.waitForTimeout(9000);
const m = await p.evaluate(() => {
  const outer = document.querySelector('iframe.game-box');
  const d = outer.contentDocument, w = outer.contentWindow;
  const g = d.querySelector('.game');
  const r = g.getBoundingClientRect();
  return {
    iframeViewport: { w: w.innerWidth, h: w.innerHeight },
    gameRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    docW: d.documentElement.clientWidth, docH: d.documentElement.clientHeight,
  };
});
console.log(JSON.stringify(m, null, 1));
await b.close();
