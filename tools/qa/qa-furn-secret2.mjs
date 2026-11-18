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
    cat.movie.goto('book', 4);
    await cat._show();
    await new Promise(r2 => setTimeout(r2, 1500));
    const trig = cat.controls.find(c => c.path === '#183');
    const secFrame = () => cat.movie.currentFrame('secret');
    const out = { trigBounds: trig?.bounds, frame0: secFrame(), clicks: [] };
    // clica 3x no trigger — toggle reveal/hide
    for (let i = 0; i < 3; i++) {
        const b = trig.bounds;
        cat.clickAt((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
        await new Promise(r2 => setTimeout(r2, 900));
        out.clicks.push(secFrame());
    }
    return out;
})()`);
console.log(JSON.stringify(r));
await page.screenshot({ path: 'tools/shots/furn-p4-after.png' });
// estado final: forca reveal e screenshot
await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue;
    const b = cat.controls.find(c => c.path === '#183')?.bounds;
    if (b && cat.movie.currentFrame('secret') !== 2) cat.clickAt((b[0]+b[2])/2,(b[1]+b[3])/2);
    await new Promise(r2 => setTimeout(r2, 1200));
})()`);
await page.screenshot({ path: 'tools/shots/furn-p4-secret.png' });
await browser.close();
