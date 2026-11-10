import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);
await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const movie = await sc.playerCard._movie();
  await sc.playerCard._build(movie, sc.localPlayer);
});
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const key = Object.keys(sc.textures.list).find(k => k.startsWith('playercard_'));
  const src = sc.textures.get(key).getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height).data;
  const W = cv.width, H = cv.height;
  const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i+1], d[i+2], d[i+3]]; };
  // cor do card = pixel central
  const cc = px(Math.floor(W/2), Math.floor(H/2));
  const isCard = (x, y) => {
    const [r,g,bl,a] = px(x,y);
    if (a < 100) return false;
    // card e azulado/escuro; fundo do canvas e transparente
    return Math.abs(r-cc[0]) + Math.abs(g-cc[1]) + Math.abs(bl-cc[2]) < 200;
  };
  // bounding box do card
  let x0=W,x1=0,y0=H,y1=0;
  for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){ if(isCard(x,y)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;} }
  // perfil do canto sup-esq: para cada y, primeiro x card; para cada x, primeiro y card
  const profX = [], profY = [];
  for (let y = y0; y < Math.min(y0+80, y1); y++) { for (let x = x0; x < Math.min(x0+80, x1); x++) if (isCard(x,y)) { profX.push([y, x]); break; } }
  for (let x = x0; x < Math.min(x0+80, x1); x++) { for (let y = y0; y < Math.min(y0+80, y1); y++) if (isCard(x,y)) { profY.push([x, y]); break; } }
  return { bbox:[x0,y0,x1,y1], profX: profX.slice(0,20), profY: profY.slice(0,20) };
});
console.log(JSON.stringify(r));
await b.close();
