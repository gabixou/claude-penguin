import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);
const info = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.igloo);
    const mgr = s.igloo;
    if (!mgr.isOwner) return { owner: false };
    mgr.toggleEditor();
    await new Promise(r => setTimeout(r, 3000));
    const c = mgr.editor._cover;
    const src = c.texture.getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const cx = cv.getContext('2d');
    cx.drawImage(src, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
        if (d[(y * cv.width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    }
    return { texW: cv.width, texH: cv.height, alphaBBox: { minX, minY, maxX, maxY }, imgScale: c.scaleX, imgX: c.x, imgY: c.y, displayW: c.displayWidth, displayH: c.displayHeight };
})()`);
console.log(JSON.stringify(info));
await browser.close();
