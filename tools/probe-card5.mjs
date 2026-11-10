import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
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
await p.screenshot({ path: 'shots/card-fixed.png' });
// cantos: mede transicao horizontal vs vertical no canto sup-esq do card
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const key = Object.keys(sc.textures.list).find(k => k.startsWith('playercard_'));
  const src = sc.textures.get(key).getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height).data;
  const W = cv.width;
  const lum = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i+1] + d[i+2] + d[i+3]; };
  // canto sup-esq: varre da borda para dentro ate achar conteudo
  // assume card ocupa a maior parte do canvas; fundo = alpha 0 ou branco
  const solid = (x, y) => d[(y * W + x) * 4 + 3] > 40;
  // encontra primeira linha/coluna solida
  let top = -1, left = -1;
  for (let y = 0; y < cv.height && top < 0; y++) for (let x = 0; x < W; x++) if (solid(x, y)) { top = y; break; }
  for (let x = 0; x < W && left < 0; x++) for (let y = 0; y < cv.height; y++) if (solid(x, y)) { left = x; break; }
  return { size: [W, cv.height], top, left };
});
console.log(JSON.stringify(r));
await b.close();
