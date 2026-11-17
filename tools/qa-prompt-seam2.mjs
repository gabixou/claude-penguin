import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForTimeout(4000);
await p.evaluate(() => window.__penguin.scene.catalogue._confirm('Test seam check message', () => {}, true));
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const pr = s.catalogue?._prompt;
  if (!pr?.isOpen) return { open: false };
  let img = null;
  pr.cont?.list?.forEach((o) => { if (o.type === 'Image') img = o; });
  if (!img) return { open: true, noImg: true };
  const src = img.texture.getSourceImage();
  const ctx = src.getContext('2d');
  const d = ctx.getImageData(0, 0, src.width, src.height).data;
  const W = src.width, H = src.height;
  const A = (x, y) => d[(y * W + x) * 4 + 3];
  // acha "ilhas" opacas: varre e marca colunas/linhas com linhas finas de
  // transparencia DENTAS de regiao opaca — heuristica: para cada coluna x,
  // conta pixels transparentes; uma emenda vertical = coluna com alpha==0
  // em muitos pixels consecutivos MAS com opacos dos dois lados na mesma faixa
  const seamsV = [], seamsH = [];
  for (let x = 1; x < W - 1; x++) {
    // run vertical de transparencia
    let y = 0;
    while (y < H) {
      if (A(x, y) >= 10) { y++; continue; }
      let y2 = y;
      while (y2 < H && A(x, y2) < 10) y2++;
      const len = y2 - y;
      // emenda: run fino (<=4px de altura nao — vertical run e altura)
      // vertical seam = run ALTO (>=30px) com coluna toda transparente
      if (len >= 30) {
        // verifica se ha opacos imediatamente a esquerda e direita na mesma faixa
        let left = 0, right = 0;
        for (let yy = y; yy < y2; yy += 4) {
          if (A(x - 1, yy) >= 10) left++;
          if (A(x + 1, yy) >= 10) right++;
        }
        if (left > len / 8 && right > len / 8) seamsV.push({ x, y0: y, len });
      }
      y = y2;
    }
  }
  for (let y = 1; y < H - 1; y++) {
    let x = 0;
    while (x < W) {
      if (A(x, y) >= 10) { x++; continue; }
      let x2 = x;
      while (x2 < W && A(x2, y) < 10) x2++;
      const len = x2 - x;
      if (len >= 30) {
        let up = 0, down = 0;
        for (let xx = x; xx < x2; xx += 4) {
          if (A(xx, y - 1) >= 10) up++;
          if (A(xx, y + 1) >= 10) down++;
        }
        if (up > len / 8 && down > len / 8) seamsH.push({ y, x0: x, len });
      }
      x = x2;
    }
  }
  return { open: true, seamsV: seamsV.slice(0, 20), seamsH: seamsH.slice(0, 20), W, H };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/prompt-seam.png' });
await b.close();
