import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(async () => {
    const { PenguinLibrary, PenguinView, veColor } = await import('/src/entities/PenguinArt.js');
    const { Clip } = await import('/src/movie/clip.js');
    const lib = await PenguinLibrary.load();
    // look do Arenovisk
    const look = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
    const COLOR = 0x3366cc;
    const W = 260, H = 260;
    function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); }
    // composed view
    const v1 = new PenguinView(lib, COLOR);
    v1.setLook(look, 1);
    v1.setFrame(26);
    v1.setRing(false);
    // espera items + frameReady
    for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 100)); if (v1.frameReady()) break; }
    v1.drawnFrame = 26;
    const c1 = mk();
    const t0 = performance.now();
    await v1.render(c1, 1);
    const composedMs = performance.now() - t0;
    // fallback view: composedDraw desligado
    const lib2 = await PenguinLibrary.load();
    lib2.composedDraw = async () => false;
    const v2 = new PenguinView(lib2, COLOR);
    v2.setLook(look, 1);
    v2.setFrame(26);
    v2.setRing(false);
    for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 100)); if (v2.frameReady()) break; }
    v2.drawnFrame = 26;
    const c2 = mk();
    const t1 = performance.now();
    await v2.render(c2, 1);
    const fallbackMs = performance.now() - t1;
    // diff
    const d1 = c1.getImageData(0, 0, W, H).data, d2 = c2.getImageData(0, 0, W, H).data;
    let diff = 0, a1 = 0, a2 = 0, maxD = 0;
    for (let i = 0; i < d1.length; i += 4) {
        if (d1[i + 3]) a1++; if (d2[i + 3]) a2++;
        const dd = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) + Math.abs(d1[i + 3] - d2[i + 3]);
        if (dd > 60) diff++;
        if (dd > maxD) maxD = dd;
    }
    return { composedMs: Math.round(composedMs), fallbackMs: Math.round(fallbackMs), a1, a2, diffPx: diff, maxD };
});
console.log(JSON.stringify(r));
await b.close();
process.exit(0);
