import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
const hits = [];
page.on('request', (r) => { const u = r.url(); if (/atlas-\d+\.png/.test(u) && (u.includes('/icons/') || u.includes('/paper/'))) hits.push(u.split('/assets/')[1]); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(15000);
const r = await page.evaluate(`(async () => {
    const { MovieRoom } = await import('/src/movie/movie.js');
    const out = {};
    for (const [kind, id] of [['icons', 1], ['icons', 1000], ['paper', 1000], ['paper', 1001]]) {
        const mv = await MovieRoom.load('/assets/' + kind + '/' + id).catch(() => null);
        out[kind + '/' + id] = mv ? { atlas: !!mv._atlas, frames: mv._atlas ? Object.keys(mv._atlas.frames).length : 0 } : null;
        mv?.prefetchFrames?.([1], 12, true, 2, false);
    }
    return out;
})()`);
console.log(JSON.stringify(r));
await page.waitForTimeout(4000);
console.log('atlas pngs:', [...new Set(hits)].slice(0, 12));
await browser.close();
