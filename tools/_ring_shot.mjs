import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(async () => {
    const { PenguinLibrary, veColor } = await import('/src/entities/PenguinArt.js');
    const { Clip } = await import('/src/movie/clip.js');
    const lib = await PenguinLibrary.load();
    const W = 220, H = 220;
    function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.scale(4,4); x.translate(W/8, H/8); return x; }
    function dump(ctx){ return ctx.canvas.toDataURL('image/png'); }
    const clip = new Clip(lib.movie);
    clip.set('body', { color: veColor(0x3366cc) });
    clip.set('ring', { visible: true });
    clip.set('hotspot', { visible: false });
    clip.set('', { frame: 26 });
    const c1 = mk();
    const ok = await lib.composedDraw(c1, clip, 26, { tint: 0x3366cc, ring: true });
    const c2 = mk();
    await clip.draw(c2, 26, 1);
    const d1 = c1.getImageData(0,0,W,H).data, d2 = c2.getImageData(0,0,W,H).data;
    let diff=0,maxD=0,a1=0,a2=0;
    for(let i=0;i<d1.length;i+=4){
      if(d1[i+3]>10)a1++; if(d2[i+3]>10)a2++;
      const dd=Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])+Math.abs(d1[i+3]-d2[i+3]);
      if(dd>60){diff++; if(dd>maxD)maxD=dd;}
    }
    return { ok, diff, maxD, a1, a2, img1: dump(c1), img2: dump(c2) };
});
fs.writeFileSync('shots/ring-composed.png', Buffer.from(r.img1.split(',')[1], 'base64'));
fs.writeFileSync('shots/ring-vector.png', Buffer.from(r.img2.split(',')[1], 'base64'));
console.log(JSON.stringify({ ok: r.ok, diff: r.diff, maxD: r.maxD, a1: r.a1, a2: r.a2 }));
await b.close();
process.exit(0);
