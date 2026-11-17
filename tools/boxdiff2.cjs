// diff em box de TELA direto (mesmas coords pros dois shots)
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [fa, fb, x, y, w, h] = process.argv.slice(2);
  const b64a = fs.readFileSync(fa).toString('base64');
  const b64b = fs.readFileSync(fb).toString('base64');
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await (await br.newContext()).newPage();
  const res = await p.evaluate(async ([sa, sb, x, y, w, h]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(sa), load(sb)]);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(ia, x, y, w, h, 0, 0, w, h); const da = cx.getImageData(0, 0, w, h).data;
    cx.clearRect(0, 0, w, h); cx.drawImage(ib, x, y, w, h, 0, 0, w, h); const db = cx.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);
      if (d > 90) n++;
    }
    return { n, total: w * h };
  }, [b64a, b64b, +x, +y, +w, +h]);
  console.log(JSON.stringify(res));
  await br.close();
})();
