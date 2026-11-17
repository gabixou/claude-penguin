import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
const hits = [];
page.on('request', (r) => { const u = r.url(); if (/atlas-\d+\.png/.test(u) && u.includes('clothing')) hits.push(u.split('/assets/')[1]); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
const r = await page.evaluate(`(async () => {
    const s = ${scene};
    const lib = s.localPlayer.view.lib;
    const out = {};
    for (const id of [8, 26, 103]) {
        const t0 = performance.now();
        const clip = await lib.itemClip(id); const mv = clip?.m || clip;
        out[id] = { ms: +(performance.now() - t0).toFixed(0), atlas: !!mv?._atlas, frames: mv?._atlas ? Object.keys(mv._atlas.frames).length : 0 };
        mv?.prefetchFrames?.([1], 12, true, 5, false);
    }
    return out;
})()`);
console.log(JSON.stringify(r));
await page.waitForTimeout(4000);
console.log('clothing atlas pngs:', [...new Set(hits)].slice(0, 10));
await browser.close();
