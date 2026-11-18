import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('console', m => console.log('PG:', m.text().slice(0, 300)));
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
const r = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue;
    cat.open('furn2008_catalogue');
    await new Promise(r2 => setTimeout(r2, 6000));
    cat.movie.goto('book', 4);
    await cat._show();
    await new Promise(r2 => setTimeout(r2, 1500));
    const m = cat.movie;
    const heads = () => [...m._playheadAll.entries()].filter(([k]) => k.includes('secret')).map(([k, h]) => ({ k, f: h.frame, stopped: h.stopped, sid: h.sid }));
    const out = { heads0: heads(), resolve: (() => { const u = m.find('secret'); return u ? { path: u.path, id: u.id } : null; })() };
    const b = cat.controls.find(c => c.path === '#183')?.bounds;
    for (let i = 0; i < 3; i++) {
        cat.clickAt((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
        await new Promise(r2 => setTimeout(r2, 700));
        out['after' + i] = { cf: m.currentFrame('secret'), heads: heads() };
    }
    return out;
})()`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
