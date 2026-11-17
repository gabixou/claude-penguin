import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
const atlasPng = [];
page.on('request', (r) => { if (/atlas-\d+\.png/.test(r.url())) atlasPng.push(r.url()); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
const r = await page.evaluate(`(async () => {
    const s = ${scene};
    const lib = s.localPlayer.view.lib;
    const t0 = performance.now();
    const mv = await lib.actionMovie(77);
    const t1 = performance.now();
    const hasAtlas = !!mv?._atlas;
    const frames = hasAtlas ? Object.keys(mv._atlas.frames).length : 0;
    // mesmo warm que PenguinArt dispara p/ poses de acao
    mv?.prefetchFrames?.([2], 12, true, 5, false);
    return { loadMs: +(t1 - t0).toFixed(0), hasAtlas, frames, base: mv?.base };
})()`);
console.log('actionMovie(77):', JSON.stringify(r));
await page.waitForTimeout(4000);
const uniq = [...new Set(atlasPng.map((u) => u.split('/assets/')[1]))];
console.log('atlas pngs:', uniq.length);
for (const u of uniq.slice(0, 15)) console.log(' ', u);
await browser.close();
