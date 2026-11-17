import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(800);
// abre catalogo p/ ter scene.catalogue e chamar _confirm (prompt real)
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => !!window.__penguin.scene.catalogue?._prompt !== undefined || window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);
await p.evaluate(() => window.__penguin.scene.catalogue._confirm('Test seam check message', () => {}, true));
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const pr = s.catalogue?._prompt;
  if (!pr?.isOpen) return { open: false };
  // textura do prompt: imagem dentro do container
  let img = null;
  pr.cont?.list?.forEach((o) => { if (o.type === 'Image') img = o; });
  if (!img) return { open: true, noImg: true };
  const src = img.texture.getSourceImage();
  const ctx = src.getContext('2d');
  const d = ctx.getImageData(0, 0, src.width, src.height).data;
  const W = src.width, H = src.height;
  // bbox dos pixels nao-transparentes
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  // varre linhas horizontais/verticais DENTRO do bbox: maior run de alpha==0
  const alphaAt = (x, y) => d[(y * W + x) * 4 + 3];
  let maxH = 0, maxV = 0, hAt = -1, vAt = -1;
  for (let y = y0 + 8; y < y1 - 8; y++) {
    let run = 0, best = 0;
    for (let x = x0 + 8; x < x1 - 8; x++) {
      run = alphaAt(x, y) < 10 ? run + 1 : 0;
      if (run > best) best = run;
    }
    if (best > maxH) { maxH = best; hAt = y; }
  }
  for (let x = x0 + 8; x < x1 - 8; x++) {
    let run = 0, best = 0;
    for (let y = y0 + 8; y < y1 - 8; y++) {
      run = alphaAt(x, y) < 10 ? run + 1 : 0;
      if (run > best) best = run;
    }
    if (best > maxV) { maxV = best; vAt = x; }
  }
  return { open: true, bbox: [x0, y0, x1, y1], maxHRun: maxH, hAt, maxVRun: maxV, vAt, W, H };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/prompt-seam.png' });
await b.close();
