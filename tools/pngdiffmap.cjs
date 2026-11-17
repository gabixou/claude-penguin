// mapa de diffs em grid 32x24 — onde as imagens divergem
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [a, b] = process.argv.slice(2);
  const b64a = fs.readFileSync(a).toString('base64');
  const b64b = fs.readFileSync(b).toString('base64');
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await (await br.newContext()).newPage();
  const grid = await p.evaluate(async ([sa, sb]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(sa), load(sb)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, w, h).data;
    x.clearRect(0, 0, w, h); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, w, h).data;
    const GX = 64, GY = 48, out = [];
    for (let gy = 0; gy < GY; gy++) {
      let line = '';
      for (let gx = 0; gx < GX; gx++) {
        let n = 0, tot = 0;
        const x0 = Math.floor(gx * w / GX), x1 = Math.floor((gx + 1) * w / GX);
        const y0 = Math.floor(gy * h / GY), y1 = Math.floor((gy + 1) * h / GY);
        for (let y = y0; y < y1; y += 4) for (let xx = x0; xx < x1; xx += 4) {
          const i = (y * w + xx) * 4; tot++;
          const d = Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);
          if (d > 90) n++;
        }
        const r = n / tot;
        line += r > 0.5 ? '#' : r > 0.25 ? 'O' : r > 0.1 ? 'o' : r > 0.03 ? '.' : ' ';
      }
      out.push(line);
    }
    return out;
  }, [b64a, b64b]);
  console.log(grid.join('\n'));
  await br.close();
})();
