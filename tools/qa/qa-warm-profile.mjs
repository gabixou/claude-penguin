// Profile do warmFrames: conta createImageBitmap vs drawImage vs tempo
// em _warmSheets vs draws.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
const LOOK = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
const r = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    s.localPlayer.setColorItemId(7);
    v.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 300; i++) { if (!(v._pendingItems > 0)) break; await new Promise(r => setTimeout(r, 100)); }
    // instrumenta no movie principal e nos item movies
    const movies = [v.lib.movie, ...[...v.items.values()].map(i=>i.m)];
    const seen = new Set(); const stats = { cib: 0, sheets: 0, sheetMs: 0, artMs: 0, tintMs: 0 };
    const t0 = performance.now();
    for (const m of movies) {
        if (!m || seen.has(m)) continue; seen.add(m);
        const os = m._atlasSheet?.bind(m);
        if (os) m._atlasSheet = (i) => { const t=performance.now(); return os(i).finally(()=>{ stats.sheetMs += performance.now()-t; stats.sheets++; }); };
        const oa = m.artCanvas?.bind(m);
        if (oa) m.artCanvas = (...a) => { const t=performance.now(); return oa(...a).finally(()=>{ stats.artMs += performance.now()-t; }); };
        const ot = m.tintedCanvas?.bind(m);
        if (ot) m.tintedCanvas = (...a) => { const t=performance.now(); return ot(...a).finally(()=>{ stats.tintMs += performance.now()-t; }); };
    }
    // conta createImageBitmap global
    const ocib = window.createImageBitmap?.bind(window);
    if (ocib) window.createImageBitmap = (...a) => { stats.cib++; return ocib(...a); };
    const wt0 = performance.now();
    await v.warmFrames();
    const warmMs = performance.now() - wt0;
    return { warmMs: +warmMs.toFixed(0), ...stats, totalMs: +(performance.now()-t0).toFixed(0) };
})()`);
console.log(JSON.stringify(r));
await browser.close();
