import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(800);
const data = await p.evaluate(() => {
  const cv = window.__penguin.scene.catalogue.canvas;
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const s = cv.width / 760;
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  // bbox do conteudo nao-transparente, amostrado
  for (let y=0;y<cv.height;y+=4) for (let x=0;x<cv.width;x+=4) {
    if (d[(y*cv.width+x)*4+3] > 10) {
      const wx=x/s, wy=y/s;
      if(wx<x0)x0=wx; if(wx>x1)x1=wx; if(wy<y0)y0=wy; if(wy>y1)y1=wy;
    }
  }
  return { bbox: {x0:Math.round(x0),y0:Math.round(y0),x1:Math.round(x1),y1:Math.round(y1)}, w: cv.width, h: cv.height, s };
});
console.log(JSON.stringify(data));
// salva o canvas como png para inspecao
const b64 = await p.evaluate(() => window.__penguin.scene.catalogue.canvas.toDataURL('image/png'));
writeFileSync('shots/cat-canvas.png', Buffer.from(b64.split(',')[1], 'base64'));
await b.close();
