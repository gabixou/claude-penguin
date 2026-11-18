import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(async () => {
    const { PenguinLibrary, veColor } = await import('/src/entities/PenguinArt.js');
    const { Clip } = await import('/src/movie/clip.js');
    const lib = await PenguinLibrary.load();
    const look = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
    const W = 200, H = 200;
    function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); }
    const out = {};
    // body sozinho
    {
        const clip = new Clip(lib.movie);
        clip.set('body', { color: veColor(0x3366cc) });
        clip.set('ring', { visible: false }); clip.set('hotspot', { visible: false });
        clip.set('', { frame: 26 });
        const c1 = mk(); await lib.composedDraw(c1, clip, 26, { tint: 0x3366cc, ring: false });
        const c2 = mk(); await clip.draw(c2, 26, 1);
        const d1 = c1.getImageData(0,0,W,H).data, d2 = c2.getImageData(0,0,W,H).data;
        let diff=0; for(let i=0;i<d1.length;i+=4){const dd=Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])+Math.abs(d1[i+3]-d2[i+3]); if(dd>60)diff++}
        out.body = diff;
    }
    // cada item sozinho
    for (const [slot, id] of Object.entries(look)) {
        const clipP = await lib.itemClip(id);
        if (!clipP) { out[slot + ':' + id] = 'no clip'; continue; }
        const inst = clipP.instance();
        inst.set('ring', { visible: false });
        inst.set('', { frame: 26 });
        const c1 = mk();
        const ok = await lib.composedDraw(c1, inst, 26, {});
        const c2 = mk();
        await inst.draw(c2, 26, 1);
        const d1 = c1.getImageData(0,0,W,H).data, d2 = c2.getImageData(0,0,W,H).data;
        let diff=0,a1=0,a2=0; for(let i=0;i<d1.length;i+=4){if(d1[i+3])a1++;if(d2[i+3])a2++;const dd=Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])+Math.abs(d1[i+3]-d2[i+3]); if(dd>60)diff++}
        out[slot + ':' + id] = { ok, diff, a1, a2 };
    }
    return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
