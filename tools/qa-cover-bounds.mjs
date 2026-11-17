import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await pg.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded', timeout: 30000 });
await pg.waitForTimeout(9000);
await pg.evaluate(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    s.igloo.toggleEditor();
});
await pg.waitForFunction(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    return !!s?.igloo?.editor?._cover;
}, null, { timeout: 25000 });
const info = await pg.evaluate(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    const img = s.igloo.editor._cover;
    const src = img.texture.getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const cx = cv.getContext('2d');
    cx.drawImage(src, 0, 0);
    const d = cx.getImageData(0, 0, src.width, src.height).data;
    let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
    for (let y = 0; y < src.height; y += 4) {
        for (let x = 0; x < src.width; x += 4) {
            if (d[(y * src.width + x) * 4 + 3] > 10) {
                if (x < minx) minx = x; if (x > maxx) maxx = x;
                if (y < miny) miny = y; if (y > maxy) maxy = y;
            }
        }
    }
    // converte p/ fracoes da textura e depois p/ coords de tela
    const fx0 = minx / src.width, fx1 = (maxx + 4) / src.width;
    const fy0 = miny / src.height, fy1 = (maxy + 4) / src.height;
    return {
        tex: [src.width, src.height], opaque: [minx, miny, maxx, maxy],
        frac: [fx0, fy0, fx1, fy1],
        screen: [
            Math.round(img.x - img.displayWidth / 2 + fx0 * img.displayWidth),
            Math.round(img.y - img.displayHeight / 2 + fy0 * img.displayHeight),
            Math.round(img.x - img.displayWidth / 2 + fx1 * img.displayWidth),
            Math.round(img.y - img.displayHeight / 2 + fy1 * img.displayHeight),
        ],
    };
});
console.log(JSON.stringify(info));
await browser.close();