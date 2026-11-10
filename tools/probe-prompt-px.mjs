import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  sc.catalogue._confirm({ name: 'Blue Hat', cost: 20, onYes: () => {} });
  await new Promise(r => setTimeout(r, 2000));
});
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  // acha a texture do prompt
  const keys = sc.textures.list ? Object.keys(sc.textures.list).filter(k => k.startsWith('prompt_ui_')) : [];
  if (!keys.length) return { err: 'no tex' };
  const img = sc.textures.get(keys[0]).getSourceImage();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const alpha = (x, y) => d[(y * W + x) * 4 + 3];
  // bounding box do painel (maior regiao azul opaca)
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2)
    if (alpha(x, y) > 100) { if (x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  // perfil do canto superior esquerdo: para cada x, primeiro y opaco
  const prof = [];
  for (let x = x0; x < Math.min(x0 + 120, W); x += 4) {
    let y = y0;
    while (y < H && alpha(x, y) < 100) y++;
    prof.push([x - x0, y - y0]);
  }
  // idem na vertical
  const vprof = [];
  for (let y = y0; y < Math.min(y0 + 120, H); y += 4) {
    let x = x0;
    while (x < W && alpha(x, y) < 100) x++;
    vprof.push([y - y0, x - x0]);
  }
  return { W, H, bbox: [x0, y0, x1, y1], prof: prof.slice(0, 15), vprof: vprof.slice(0, 15) };
});
console.log(JSON.stringify(r));
await b.close();
