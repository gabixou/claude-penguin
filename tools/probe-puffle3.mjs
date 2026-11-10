import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.goto('http://localhost:3000/minigames/pufflescape/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
const r = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const ctx = c.getContext('2d');
  // amostra pixels: conta nao-preto
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 400) if (d[i] + d[i+1] + d[i+2] > 60) lit++;
  return { lit, total: d.length / 400 };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/puffle-boot2.png' });
await b.close();
