import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
function load(p) { const i = decodePNG(fs.readFileSync(p)); return { w: i.w, h: i.h, ch: i.data.length === i.w * i.h * 3 ? 3 : 4, d: i.data }; }
function crop(img, x0, y0, w, h, name, scale = 4) {
  const W = w * scale, H = h * scale;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(img.w - 1, x0 + (x / scale | 0)), sy = Math.min(img.h - 1, y0 + (y / scale | 0));
    const si = (sy * img.w + sx) * img.ch, di = (y * W + x) * 4;
    out[di] = img.d[si]; out[di + 1] = img.d[si + 1]; out[di + 2] = img.d[si + 2];
    out[di + 3] = img.ch === 4 ? img.d[si + 3] : 255;
  }
  fs.writeFileSync('tools/shots/' + name, encodePNG(W, H, 4, out));
  console.log(name, W + 'x' + H);
}
// clone: penguin world (414,393) -> screen ~ (38 + x*0.562, y*0.562); puffle (394,401)
// crop generous box around both: world x 340-490, y 320-440 -> screen
const c = load('tools/shots/clone-town-puffle.png');
console.log('clone size', c.w, c.h);
crop(c, 190, 175, 180, 160, 'crop-clone-puffle.png', 4);
const r = load('tools/shots/ref-town-rockhopper.png');
console.log('ref size', r.w, r.h);
// Rockhopper: left/center da town — crop regiao esquerda-inferior ampla
crop(r, 60, 300, 420, 240, 'crop-ref-rockhopper-a.png', 3);
crop(r, 300, 250, 420, 280, 'crop-ref-rockhopper-b.png', 3);
