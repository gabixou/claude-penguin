import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newBrowser ? null : null;
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
    // amostra pixels: cantos e centro do canvas da textura
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const cx = cv.getContext('2d');
    cx.drawImage(src, 0, 0);
    const pts = { TL: [4,4], TR: [src.width-5,4], BL: [4,src.height-5], BR: [src.width-5,src.height-5], C: [src.width/2|0, src.height/2|0] };
    const px = {};
    for (const [k,[x,y]] of Object.entries(pts)) {
        const d = cx.getImageData(x,y,1,1).data;
        px[k] = [d[0],d[1],d[2],d[3]];
    }
    return { texW: src.width, texH: src.height, imgX: img.x, imgY: img.y, imgW: img.displayWidth, imgH: img.displayHeight, px };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();