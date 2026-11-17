// converte PNG em ASCII art (brilho) — uso: node png-ascii.mjs file.png [cols]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, f, colsArg] = process.argv;
const cols = +(colsArg || 80);
const b64 = fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
const rows = await p.evaluate(async ([s, C]) => {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
  const w = img.width, h = img.height;
  const R = Math.round(C * h / w / 2); // chars ~2x tall
  const c = document.createElement('canvas'); c.width = C; c.height = R;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, C, R);
  const d = x.getImageData(0, 0, C, R).data;
  const chars = ' .:-=+*#%@';
  const out = [];
  for (let y = 0; y < R; y++) {
    let line = '';
    for (let xx = 0; xx < C; xx++) {
      const i = (y * C + xx) * 4;
      // distancia do fundo azul #20304a
      const dr = d[i] - 0x20, dg = d[i + 1] - 0x30, db = d[i + 2] - 0x4a;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      line += chars[Math.min(9, Math.floor(dist / 28))];
    }
    out.push(line);
  }
  return out;
}, [b64, cols]);
console.log(rows.join('\n'));
await b.close();
