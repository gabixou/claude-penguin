import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(async () => {
    const { PenguinLibrary, veColor } = await import('/src/entities/PenguinArt.js');
    const { Clip } = await import('/src/movie/clip.js');
    const lib = await PenguinLibrary.load();
    const W = 220, H = 220;
    function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); }
    const clip = new Clip(lib.movie);
    clip.set('body', { color: veColor(0x3366cc) });
    clip.set('ring', { visible: true });
    clip.set('hotspot', { visible: false });
    clip.set('', { frame: 26 });
    // composed COM anel (jogador local)
    const c1 = mk();
    const ok = await lib.composedDraw(c1, clip, 26, { tint: 0x3366cc, ring: true });
    // vetorial com anel
    const c2 = mk();
    await clip.draw(c2, 26, 1);
    // recorta regiao do anel (base do pinguim ~ y 60-75% da altura)
    const d1 = c1.getImageData(0,0,W,H).data, d2 = c2.getImageData(0,0,W,H).data;
    let diff=0, ringPx1=0, ringPx2=0;
    for(let y=140;y<200;y++)for(let x=40;x<180;x++){
      const i=(y*W+x)*4;
      // anel e azulado claro
      if(d1[i+2]>150&&d1[i+2]>d1[i]+30&&d1[i+3]>100) ringPx1++;
      if(d2[i+2]>150&&d2[i+2]>d2[i]+30&&d2[i+3]>100) ringPx2++;
      const dd=Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])+Math.abs(d1[i+3]-d2[i+3]);
      if(dd>60)diff++;
    }
    return { ok, diffRingArea: diff, ringPxComposed: ringPx1, ringPxVector: ringPx2 };
});
console.log(JSON.stringify(r));
await b.close();
process.exit(0);
