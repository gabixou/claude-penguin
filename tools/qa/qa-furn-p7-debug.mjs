import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
const r = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue;
    cat.open('furn2008_catalogue');
    await new Promise(r2 => setTimeout(r2, 6000));
    cat.movie.goto('book', 7);
    await cat._show();
    await new Promise(r2 => setTimeout(r2, 2000));
    const movie = cat.movie;
    const heads = movie._playheads ? [...movie._playheads.keys()] : [];
    const ctrls = cat.controls.map(x => ({ p: x.path, b: x.bounds, l: x.label, r: x.release }));
    return { heads, secretFrame: movie.currentFrame('secret'), n: ctrls.length,
             nextFrameCtrls: ctrls.filter(c => c.r && c.r.includes('nextFrame')),
             secretCtrls: ctrls.filter(c => c.p.includes('secret') || (c.l||'').toLowerCase().includes('secret')) };
})()`);
console.log(JSON.stringify(r, null, 1).slice(0, 6000));
await browser.close();
