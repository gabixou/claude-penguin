// ellipse-hunt.mjs <png> <x0> <y0> <w> <h> — acha pixels que destoa
// da cor dominante do piso (a elipse clara) e lista cor+posicao
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const [,, inp, X, Y, W, H] = process.argv;
const b64 = fs.readFileSync(inp).toString('base64');
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const res = await p.evaluate(async ([src, x0, y0, w, h]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    // cor dominante do piso = mediana dos pixels da regiao
    const samples = [];
    for (let y = y0; y < y0 + h; y += 4)
        for (let x = x0; x < x0 + w; x += 4) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            samples.push([d[0], d[1], d[2]]);
        }
    samples.sort((a, b2) => (a[0] + a[1] + a[2]) - (b2[0] + b2[1] + b2[2]));
    const med = samples[Math.floor(samples.length / 2)];
    const hits = {};
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            const dist = Math.abs(d[0] - med[0]) + Math.abs(d[1] - med[1]) + Math.abs(d[2] - med[2]);
            if (dist > 60) {
                const hh = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
                hits[hh] = hits[hh] || { n: 0, xs: [], ys: [] };
                hits[hh].n++;
                if (hits[hh].xs.length < 3) { hits[hh].xs.push(x); hits[hh].ys.push(y); }
            }
        }
    }
    return { med: '#' + med.map((v) => v.toString(16).padStart(2, '0')).join(''), hits: Object.entries(hits).sort((a, b2) => b2[1].n - a[1].n).slice(0, 15) };
}, ['data:image/png;base64,' + b64, +X, +Y, +W, +H]);
await b.close();
console.log('piso dominante:', res.med);
for (const [h, v] of res.hits) console.log(h, 'x' + v.n, 'em', v.xs.map((x, i) => `(${x},${v.ys[i]})`).join(' '));
