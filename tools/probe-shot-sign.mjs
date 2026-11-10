import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
// recorta a regiao do letreiro da boate (topo-centro do canvas do jogo)
const cv = await p.$('canvas');
const box = await cv.boundingBox();
console.log('canvas box', JSON.stringify(box));
// canvas 1710x1080 em 1920x1080 -> mundo 760x480. letreiro ~ world x 280-480, y 30-170
const sx = box.x + (280/760)*box.width, sy = box.y + (30/480)*box.height;
const sw = ((480-280)/760)*box.width, sh = ((170-30)/480)*box.height;
await p.screenshot({ path: 'shots/clone-sign.png', clip: { x: sx, y: sy, width: sw, height: sh } });
// tambem recorte maior do topo
await p.screenshot({ path: 'shots/clone-top.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height*0.45 } });
console.log('done');
await b.close();
