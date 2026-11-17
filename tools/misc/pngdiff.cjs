const fs = require('fs');
const zlib = require('zlib');
function decodePNG(buf) {
    let pos = 8; let w, h, ct; const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.slice(pos + 8, pos + 8 + len); pos += 12 + len;
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
        else if (type === 'IDAT') idat.push(data);
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : ct === 4 ? 2 : 1;
    const stride = w * ch; const out = Buffer.alloc(h * stride); let rp = 0;
    const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
    for (let y = 0; y < h; y++) {
        const f = raw[rp++]; const row = raw.slice(rp, rp + stride); rp += stride;
        const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
        const cur = out.slice(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
            let v = row[x];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) v += paeth(a, b, c);
            cur[x] = v & 255;
        }
    }
    return { w, h, ch, data: out };
}
function diff(a, b, box, thresh = 24) {
    const reg = box || { x: 0, y: 0, w: a.w, h: a.h };
    let n = 0, max = 0;
    const xs = [], ys = [];
    for (let y = reg.y; y < reg.y + reg.h && y < a.h; y++) for (let x = reg.x; x < reg.x + reg.w && x < a.w; x++) {
        const i = (y * a.w + x) * a.ch;
        const m = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
        if (m > thresh) { n++; if (m > max) max = m; xs.push(x); ys.push(y); }
    }
    const bb = n ? { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } : null;
    return { changedPx: n, max, bb };
}
const [,, f1, f2, ...rest] = process.argv;
const A = decodePNG(fs.readFileSync(f1));
const B = decodePNG(fs.readFileSync(f2));
console.log('dims', A.w, A.h, A.ch);
// mapa de dif em blocos 40px
for (let y = 0; y < A.h; y += 40) {
    let line = '';
    for (let x = 0; x < A.w; x += 40) {
        const r = diff(A, B, { x, y, w: 40, h: 40 });
        line += r.changedPx > 200 ? '#' : r.changedPx > 40 ? '+' : r.changedPx > 5 ? '.' : ' ';
    }
    console.log('y' + String(y).padStart(3), line);
}
const total = diff(A, B);
console.log('TOTAL', JSON.stringify(total));
