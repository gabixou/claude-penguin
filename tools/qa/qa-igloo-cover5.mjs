import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
const info = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    // pega o MovieRoom do igloo-as2 via igloo manager ou load direto
    const { MovieRoom } = await import('/src/movie/movie.js');
    const m = await MovieRoom.load('/assets/movies/igloo-as2');
    const ch = m.characters['18'];
    const bmp = await m.artCanvas('18.svg', ch, 4.5);
    if (!bmp) return { err: 'no bitmap' };
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const cx = cv.getContext('2d');
    cx.drawImage(bmp, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < cv.height; y += 4) for (let x = 0; x < cv.width; x += 4) {
        if (d[(y * cv.width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    }
    return { bmpW: bmp.width, bmpH: bmp.height, alpha: { minX, minY, maxX, maxY }, atlasFrame: m._atlas?.frames?.['18.svg'], charSize: ch.size, charOrigin: ch.origin, isCanvas: bmp instanceof HTMLCanvasElement };
})()`);
console.log(JSON.stringify(info, null, 1));
await browser.close();
