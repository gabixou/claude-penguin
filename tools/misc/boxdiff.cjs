// diff restrito a uma caixa de mundo -> coords de tela de cada shot
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [fa, fb, wx0, wy0, wx1, wy1, scaleA, offAx, offAy, scaleB, offBx, offBy] = process.argv.slice(2);
  const b64a = fs.readFileSync(fa).toString('base64');
  const b64b = fs.readFileSync(fb).toString('base64');
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await (await br.newContext()).newPage();
  const res = await p.evaluate(async ([sa, sb, wx0, wy0, wx1, wy1, sA, oxA, oyA, sB, oxB, oyB]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(sa), load(sb)]);
    const ax = Math.floor(oxA + wx0 * sA), ay = Math.floor(oyA + wy0 * sA);
    const aw = Math.floor((wx1 - wx0) * sA), ah = Math.floor((wy1 - wy0) * sA);
    const bx = Math.floor(oxB + wx0 * sB), by = Math.floor(oyB + wy0 * sB);
    const bw = Math.floor((wx1 - wx0) * sB), bh = Math.floor((wy1 - wy0) * sB);
    const w = Math.min(aw, bw), h = Math.min(ah, bh);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(ia, ax, ay, w, h, 0, 0, w, h); const da = x.getImageData(0, 0, w, h).data;
    x.clearRect(0, 0, w, h); x.drawImage(ib, bx, by, w, h, 0, 0, w, h); const db = x.getImageData(0, 0, w, h).data;
    let n = 0, sum = 0;
    const GX = 40, GY = 30, out = [];
    for (let gy = 0; gy < GY; gy++) {
      let line = '';
      for (let gx = 0; gx < GX; gx++) {
        let cnt = 0, tot = 0;
        for (let y = Math.floor(gy*h/GY); y < Math.floor((gy+1)*h/GY); y++)
          for (let xx = Math.floor(gx*w/GX); xx < Math.floor((gx+1)*w/GX); xx++) {
            const i = (y*w+xx)*4; tot++;
            const d = Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);
            if (d > 90) cnt++;
          }
        const r = cnt/tot; sum += r; n += cnt;
        line += r > 0.5 ? '#' : r > 0.25 ? 'O' : r > 0.1 ? 'o' : r > 0.03 ? '.' : ' ';
      }
      out.push(line);
    }
    return { n, grid: out };
  }, [b64a, b64b, +wx0, +wy0, +wx1, +wy1, +scaleA, +offAx, +offAy, +scaleB, +offBx, +offBy]);
  console.log('diffpx', res.n);
  console.log(res.grid.join('\n'));
  await br.close();
})();
