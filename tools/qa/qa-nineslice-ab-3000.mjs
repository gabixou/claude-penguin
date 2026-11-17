import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1000);
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  if (!movie) return { err: 'no movie' };
  await movie.ensureFonts();
  const matMul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
  });
  const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
  // algoritmo VETORIAL antigo (git e2cb7f5^)
  const oldNine = async (ctx, frame, world, path, color, scale, depth, grid, local) => {
    const p = movie._boundsOfEntries(frame, { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, path);
    if (!p) { await movie._drawEntries(ctx, frame, world, path, color, scale, depth + 1); return; }
    const b = [p[0], grid[0], grid[2], p[2]];
    const v = [p[1], grid[1], grid[3], p[3]];
    const w = Math.min(1, ((p[2] - p[0]) * local.a) / ((grid[0] - p[0]) + (p[2] - grid[2])));
    const S = Math.min(1, ((p[3] - p[1]) * local.d) / ((grid[1] - p[1]) + (p[3] - grid[3])));
    const x = [p[0], p[0] + (grid[0] - p[0]) * w / local.a,
      p[2] - (p[2] - grid[2]) * w / local.a, p[2]];
    const C = [p[1], p[1] + (grid[1] - p[1]) * S / local.d,
      p[3] - (p[3] - grid[3]) * S / local.d, p[3]];
    const devRect = (rx, ry, rw, rh) => {
      const pts = [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]
        .map(([px, py]) => [world.a * px + world.c * py + world.x, world.b * px + world.d * py + world.y]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    };
    for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) {
      const P = x[cc + 1] - x[cc], I = C[rr + 1] - C[rr];
      if (P <= 0 || I <= 0 || b[cc + 1] === b[cc] || v[rr + 1] === v[rr]) continue;
      const kx = P / (b[cc + 1] - b[cc]);
      const ky = I / (v[rr + 1] - v[rr]);
      const t = { a: kx, b: 0, c: 0, d: ky, x: x[cc] - b[cc] * kx, y: C[rr] - v[rr] * ky };
      const mSlice = matMul(world, t);
      const [dx, dy, dw, dh] = devRect(x[cc], C[rr], P, I);
      if (dw <= 0 || dh <= 0) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
      await movie._drawEntries(ctx, frame, mSlice, path, color, scale, depth + 1);
      ctx.restore();
    }
  };
  const mk = () => { const c = document.createElement('canvas'); c.width = 1400; c.height = 1400; return c; };
  // testa TODOS os sprites com scalingGrid
  const sids = Object.keys(movie.scalingGrids || {});
  const results = [];
  for (const sid of sids) {
    const sp = movie.sprites[sid];
    const grid = movie.scalingGrids[sid];
    const frame = sp?.frames?.[0];
    if (!frame?.length) { results.push({ sid, skip: 'no frame' }); continue; }
    const p = movie._boundsOfEntries(frame, { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, 'test');
    if (!p) { results.push({ sid, skip: 'no bounds' }); continue; }
    const entryInfo = frame.map(e => ({ id: e.id, kind: movie.characters?.[e.id]?.kind, isSprite: !!movie.sprites?.[e.id] }));
    const out = [];
    for (const cs of [
      { name: 'stretch', parent: { a: 2, b: 0, c: 0, d: 2, x: 100, y: 100 }, local: { a: 1.8, b: 0, c: 0, d: 1.5, x: 30, y: 20 } },
      { name: 'shrink', parent: { a: 2, b: 0, c: 0, d: 2, x: 100, y: 100 }, local: { a: 0.6, b: 0, c: 0, d: 0.6, x: 10, y: 10 } },
    ]) {
      const world = matMul(cs.parent, cs.local);
      const cOld = mk(), cNew = mk();
      const xOld = cOld.getContext('2d'), xNew = cNew.getContext('2d');
      await oldNine(xOld, frame, world, 'test', IDENT_COLOR, 2, 1, grid, cs.local);
      await movie._drawNineSlice(xNew, frame, world, 'test', IDENT_COLOR, 2, 1, grid, cs.local);
      const d1 = xOld.getImageData(0, 0, 1400, 1400).data;
      const d2 = xNew.getImageData(0, 0, 1400, 1400).data;
      let diff = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const dd = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) + Math.abs(d1[i + 3] - d2[i + 3]);
        if (dd > 24) diff++;
      }
      out.push({ name: cs.name, diffPx: diff });
    }
    results.push({ sid, grid, p, entryInfo, out });
  }
  return { results };
});
console.log(JSON.stringify({ ...r, oldPng: r.oldPng?.length, newPng: r.newPng?.length }, null, 1));
import { writeFileSync } from 'node:fs';
if (r.oldPng) {
  writeFileSync('shots/ns-old.png', Buffer.from(r.oldPng.split(',')[1], 'base64'));
  writeFileSync('shots/ns-new.png', Buffer.from(r.newPng.split(',')[1], 'base64'));
}
await b.close();
