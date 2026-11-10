// Cruza os 16 icones do atlas ui-icons.png com os botoes do dock no screenshot ref.
import { decodePNG } from './png.mjs';
import fs from 'node:fs';

const atlas = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/ui-icons.png'));
const ref = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/tools/shots/ref-town.png'));
console.log('atlas', atlas.w, atlas.h, 'ref', ref.w, ref.h);

const mkpx = (img) => {
  const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
  return (x, y) => { const i = (y * img.w + x) * ch; return [img.data[i], img.data[i+1], img.data[i+2], ch === 4 ? img.data[i+3] : 255]; };
};
const pxA = mkpx(atlas), pxR = mkpx(ref);

// regiao do dock no ref: faixa inferior ~110px
const dockY0 = ref.h - 120;

// para cada celula 32x32 do atlas, template-match na regiao do dock (escala 1.0 e 1.4)
for (let c = 0; c < 16; c++) {
  const ax = c * 32;
  // coleta pixels nao-transparentes do icone
  const tpl = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const [r,g,b,a] = pxA( ax+x, y);
    if (a > 100) tpl.push({x, y, r, g, b});
  }
  if (!tpl.length) { console.log('icon', c, 'vazio'); continue; }
  // bbox do icone
  const xs = tpl.map(p=>p.x), ys = tpl.map(p=>p.y);
  const bx0=Math.min(...xs), bx1=Math.max(...xs), by0=Math.min(...ys), by1=Math.max(...ys);
  const bw = bx1-bx0+1, bh = by1-by0+1;

  let best = {score: 1e18, x:0, y:0, s:1};
  for (const s of [1.0, 1.3]) {
    const W = Math.round(bw*s), H = Math.round(bh*s);
    for (let y = dockY0; y < ref.h - H; y += 2) {
      for (let x = 0; x < ref.w - W; x += 2) {
        // compara amostrando ate 60 pixels do template
        let err = 0, n = 0;
        const step = Math.max(1, Math.floor(tpl.length / 60));
        for (let i = 0; i < tpl.length; i += step) {
          const p = tpl[i];
          const rx = x + Math.round((p.x - bx0) * s), ry = y + Math.round((p.y - by0) * s);
          const [r,g,b] = pxR( rx, ry);
          err += Math.abs(r-p.r)+Math.abs(g-p.g)+Math.abs(b-p.b); n++;
        }
        err /= n;
        if (err < best.score) best = {score: err, x, y, s};
      }
    }
  }
  console.log('icon', String(c).padStart(2), 'bbox', bw+'x'+bh, 'best@', best.x+','+best.y, 'scale', best.s, 'err', best.score.toFixed(1));
}
