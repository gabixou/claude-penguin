import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
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
  let img = null;
  pr?.cont?.list?.forEach((o) => { if (o.type === 'Image') img = o; });
  if (!img) return { noImg: true };
  const src = img.texture.getSourceImage();
  const ctx = src.getContext('2d');
  const d = ctx.getImageData(0, 0, src.width, src.height).data;
  const W = src.width, H = src.height;
  const px = (x, y) => [d[(y * W + x) * 4], d[(y * W + x) * 4 + 1], d[(y * W + x) * 4 + 2], d[(y * W + x) * 4 + 3]];
  // acha a linha do meio do painel: varre y central do bbox opaco
  // bbox opaco
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (d[(y * W + x) * 4 + 3] > 200) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const my = Math.floor((y0 + y1) / 2);
  // perfil horizontal: transicoes de cor ao longo de my
  const prof = [];
  for (let x = x0; x <= x1; x++) {
    const c = px(x, my);
    prof.push(c[2] > 150 && c[0] < 150 ? 'B' : (c[3] < 50 ? '.' : 'o'));
  }
  // comprime runs
  const runs = [];
  let cur = prof[0], n = 1;
  for (let i = 1; i < prof.length; i++) {
    if (prof[i] === cur) n++; else { runs.push([cur, n]); cur = prof[i]; n = 1; }
  }
  runs.push([cur, n]);
  return { bbox: [x0, y0, x1, y1], midY: my, runs: runs.slice(0, 30) };
});
console.log(JSON.stringify(r));
await b.close();
