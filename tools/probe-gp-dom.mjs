import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const out = {};
  out.canvases = [...document.querySelectorAll('canvas')].map(c => {
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, x: r.x, y: r.y, cw: r.width, ch: r.height };
  });
  // procura objetos globais do jogo
  out.globals = Object.keys(window).filter(k => /game|gp|penguin|room|scale/i.test(k)).slice(0, 30);
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
