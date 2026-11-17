import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/ref-papirolo.png'));
const W = img.w, H = img.h, d = img.data, ch = img.ch;
const px = (x, y) => { const i = (y * W + x) * ch; return [d[i], d[i + 1], d[i + 2]]; };
function clusters(pred, maxR) {
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pred(px(x, y))) pts.push([x, y]);
  const cs = [];
  for (const p of pts) {
    let best = null, bd = maxR * maxR;
    for (const c of cs) { const dx = p[0] - c.cx, dy = p[1] - c.cy, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = c; } }
    if (best) { best.n++; best.sx += p[0]; best.sy += p[1]; best.x0 = Math.min(best.x0, p[0]); best.x1 = Math.max(best.x1, p[0]); best.y0 = Math.min(best.y0, p[1]); best.y1 = Math.max(best.y1, p[1]); best.cx = best.sx / best.n; best.cy = best.sy / best.n; }
    else cs.push({ n: 1, sx: p[0], sy: p[1], cx: p[0], cy: p[1], x0: p[0], x1: p[0], y0: p[1], y1: p[1] });
  }
  return cs.sort((a, b) => b.n - a.n);
}
const show = (label, cs) => { console.log(label); for (const c of cs.slice(0, 10)) console.log({ n: c.n, bbox: [c.x0, c.y0, c.x1, c.y1], w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1, cx: Math.round(c.cx), cy: Math.round(c.cy) }); };
// puffle azul claro: cyan — B e G altos, R baixo
show('CYAN', clusters((c) => c[2] > 170 && c[1] > 170 && c[0] < 170, 60));
// pinguim vermelho: R alto, G/B baixos
show('RED', clusters((c) => c[0] > 180 && c[1] < 120 && c[2] < 120, 80));
