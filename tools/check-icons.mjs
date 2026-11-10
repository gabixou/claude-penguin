import fs from 'node:fs';
import zlib from 'node:zlib';
// decoder PNG minimo p/ RGBA8
function decodePNG(buf) {
    let off = 8; const idat = [];
    let w, h;
    while (off < buf.length) {
        const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
        if (type === 'IDAT') idat.push(data);
        off += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const bpp = 4, stride = w * bpp;
    const out = Buffer.alloc(w * h * bpp);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)];
        const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
            let v = line[i];
            if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
            else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
            line[i] = v;
        }
        line.copy(out, y * stride); prev = line;
    }
    return { w, h, data: out };
}
const img = decodePNG(fs.readFileSync(process.argv[2] || 'icons.png'));
console.log('size', img.w, img.h);
// ASCII do alpha de cada celula 32x32
for (let cy = 0; cy < img.h / 32; cy++) {
    for (let cx = 0; cx < img.w / 32; cx++) {
        let opaque = 0, total = 0;
        for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) {
            const i = ((cy * 32 + y) * img.w + cx * 32 + x) * 4;
            if (img.data[i + 3] > 128) opaque++; total++;
        }
        process.stdout.write(String(opaque / total * 100).padStart(4) + '% ');
    }
    console.log(' <- row ' + cy);
}
// amostra visual ASCII da celula 0 (32x32 -> 16x16 chars)
console.log('--- cell 0 alpha map ---');
for (let y = 0; y < 32; y += 2) {
    let row = '';
    for (let x = 0; x < 32; x += 2) {
        const i = (y * img.w + x) * 4;
        row += img.data[i + 3] > 128 ? '#' : (img.data[i + 3] > 30 ? '+' : '.');
    }
    console.log(row);
}
