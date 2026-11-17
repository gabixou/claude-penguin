import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/').catch(() => {});
await p.setContent('<html><body></body></html>');
const res = await p.evaluate(() => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const W = img.naturalWidth, H = img.naturalHeight;
    const d = x.getImageData(0, 0, W, H).data;
    const dark = (i) => d[i] < 45 && d[i+1] < 45 && d[i+2] < 45;
    // procura retangulos: para cada celula 8x8, conta pixels escuros
    const cell = 8, gw = Math.floor(W / cell), gh = Math.floor(H / cell);
    const grid = [];
    for (let j = 0; j < gh; j++) {
      const row = [];
      for (let i = 0; i < gw; i++) {
        let n = 0;
        for (let y = 0; y < cell; y++) for (let xx = 0; xx < cell; xx++)
          if (dark(((j * cell + y) * W + i * cell + xx) * 4)) n++;
        row.push(n / (cell * cell));
      }
      grid.push(row);
    }
    // acha blocos contiguos >0.9 escuro com tamanho >= 3 celulas
    const rects = [];
    const seen = new Set();
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      if (seen.has(k) || grid[j][i] < 0.9) continue;
      let w = 0; while (i + w < gw && grid[j][i + w] >= 0.9) w++;
      let h = 0;
      outer: for (let jj = j; jj < gh; jj++) {
        for (let ii = i; ii < i + w; ii++) if (grid[jj][ii] < 0.9) break outer;
        h++;
      }
      for (let jj = j; jj < j + h; jj++) for (let ii = i; ii < i + w; ii++) seen.add(jj * gw + ii);
      if (w >= 3 && h >= 3) rects.push([i * cell, j * cell, w * cell, h * cell]);
    }
    res(rects.slice(0, 40));
  };
  img.src = '/_shot.png';
}));
console.log(JSON.stringify(res));
await b.close();
