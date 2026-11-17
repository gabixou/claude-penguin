import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForTimeout(8000);
const shot = await p.screenshot({ path: 'tools/tools/shots/beans-cover.png' });
// abre o png e amostra pixels nas bordas
const q = await (await b.newContext()).newPage();
await q.goto('file:///E:/project/club-penguin-browser/tools/tools/shots/beans-cover.png');
const px = await q.evaluate(() => new Promise(res => {
  const img = document.querySelector('img') || (() => { const i = new Image(); i.src = location.href; document.body.appendChild(i); return i; })();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const pts = {};
    const grab = (x0, y0, w, h) => {
      const d = x.getImageData(x0, y0, w, h).data;
      const s = new Set();
      for (let i = 0; i < d.length; i += 40) s.add(`${d[i]},${d[i+1]},${d[i+2]}`);
      return [...s].slice(0, 5).join(' | ');
    };
    res({
      topo: grab(0, 0, img.width, 30),
      base: grab(0, img.height - 30, img.width, 30),
      esq: grab(0, 0, 30, img.height),
      dir: grab(img.width - 30, 0, 30, img.height),
      centro: grab(img.width/2 - 50, img.height/2 - 50, 100, 100),
    });
  };
}));
console.log(JSON.stringify(px, null, 1));
await b.close();
