import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: 'shots/town-now.png' });
// regiao do letreiro em screen px: bounds [290,50,198,70] -> escala 1280/760=1.684
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  // amostra o canvas do overlay nightclubsign_mc diretamente
  const d = (sc._dynList || []).find(x => x.path.endsWith('nightclubsign_mc'));
  if (!d?.canvas) return { err: 'no dyn' };
  const c = d.canvas, cx = c.getContext('2d');
  const id = cx.getImageData(0, 0, c.width, c.height).data;
  // conta pixels por faixa de luminosidade e acha bbox do conteudo
  let op = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (id[i + 3] > 40) { op++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { canvas: [c.width, c.height], op, bbox: [x0, y0, x1, y1], ox: d.ox, oy: d.oy };
});
console.log(JSON.stringify(r));
await b.close();
