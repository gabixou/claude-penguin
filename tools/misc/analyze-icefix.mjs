import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/').catch(() => {});
await p.setContent('<html><body></body></html>');
const res = await p.evaluate(async () => {
  const load = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = '/' + n; });
  const cv = [];
  for (const n of ['icefix-0.png','icefix-1.png','icefix-2.png']) {
    const img = await load('tools/tools/shots/' + n);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); cv.push(x.getImageData(0,0,c.width,c.height));
  }
  const W = cv[0].width, H = cv[0].height;
  // retangulos pretos: blocos 16x16 com media lum < 30
  const black = [];
  for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
    let s = 0;
    for (let j = 0; j < 16; j += 4) for (let i = 0; i < 16; i += 4) {
      const d = cv[0].data[((y+j)*W + x+i)*4];
      s += d;
    }
    if (s / 16 < 30) black.push([x, y]);
  }
  // flicker: diffs entre frames consecutivos na area do jogo (todo o canvas)
  let diff01 = 0, diff12 = 0;
  for (let i = 0; i < cv[0].data.length; i += 40) {
    diff01 += Math.abs(cv[0].data[i] - cv[1].data[i]);
    diff12 += Math.abs(cv[1].data[i] - cv[2].data[i]);
  }
  const n = cv[0].data.length / 40;
  return { blackCells: black.length, blackSample: black.slice(0, 10), avgDiff01: diff01 / n, avgDiff12: diff12 / n };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
