import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  const out = {};
  // bounds mundo do sprite 76 (sign2_mc) e 151 (sign1/canopy) e das signs
  const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  // anda a arvore acumulando matrix
  const res = {};
  const walk = (entries, matrix, path) => {
    for (const e of entries || []) {
      const p2 = path ? path + '.' + (e.name || '#' + e.id) : (e.name || '#' + e.id);
      const w = { a: matrix.a * e.matrix[0] + matrix.c * e.matrix[1], b: matrix.b * e.matrix[0] + matrix.d * e.matrix[1], c: matrix.a * e.matrix[2] + matrix.c * e.matrix[3], d: matrix.b * e.matrix[2] + matrix.d * e.matrix[3], x: matrix.a * e.matrix[4] + matrix.c * e.matrix[5] + matrix.x, y: matrix.b * e.matrix[4] + matrix.d * e.matrix[5] + matrix.y };
      const sid = String(e.id);
      if (['76', '151', '36', '44', '92'].includes(sid)) {
        res[p2] = { matrix: e.matrix, world: [w.a.toFixed(2), w.b.toFixed(2), w.c.toFixed(2), w.d.toFixed(2), w.x.toFixed(1), w.y.toFixed(1)] };
      }
      const sp = m.sprites[sid];
      if (sp) walk(sp.frames[0] || [], w, p2);
    }
  };
  walk(m._mainTl.frames[0], ID, '');
  return res;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
