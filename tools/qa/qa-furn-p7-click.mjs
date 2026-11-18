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
    await new Promise(r2 => setTimeout(r2, 1500));
    const trig = cat.controls.find(x => x.release && x.release.includes('secret.nextFrame'));
    const seq = [];
    for (let i = 0; i < 3; i++) {
        if (i > 0) {
            cat.clickAt((trig.bounds[0]+trig.bounds[2])/2, (trig.bounds[1]+trig.bounds[3])/2);
            await new Promise(r2 => setTimeout(r2, 900));
        }
        seq.push(cat.movie.currentFrame('secret'));
    }
    return { trigPath: trig.path, trigBounds: trig.bounds, seq };
})()`);
console.log(JSON.stringify(r));
await page.screenshot({ path: 'tools/shots/furn-p7-secret.png' });
await browser.close();
