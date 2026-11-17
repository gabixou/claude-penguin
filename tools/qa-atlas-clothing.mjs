import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
const hits = [];
page.on('request', (r) => { const u = r.url(); if (/atlas-\d+\.png/.test(u) && !u.includes('movies/penguin/')) hits.push(u.split('/assets/')[1]); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(25000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
// clothing: itemClip do look equipado + um icon qualquer
const r = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    const lib = v.lib;
    const out = { look: v.look };
    // itemClip de uma roupa qualquer
    const cid = Object.values(v.look || {}).find(Boolean);
    if (cid) {
        const t0 = performance.now();
        const mv = await lib.itemClip(Number(cid));
        out.clothingId = cid;
        out.clothingAtlas = !!mv?._atlas;
        out.clothingFrames = mv?._atlas ? Object.keys(mv._atlas.frames).length : 0;
        out.clothingMs = +(performance.now() - t0).toFixed(0);
    }
    // icons/paper via MovieRoom.load direto
    const { default: MR } = await import('/src/movie/movie.js').catch(() => ({}));
    return out;
})()`);
console.log(JSON.stringify(r));
await page.waitForTimeout(3000);
console.log('non-penguin atlas pngs:', [...new Set(hits)].slice(0, 10));
await browser.close();
