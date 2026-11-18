import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);
await page.screenshot({ path: 'tools/shots/igloo-normal.png' });
// tambem: quais images depth<10 existem
const info = await page.evaluate(`(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.igloo);
    return s.children.list.filter(o => o.type === 'Image' && o.depth < 15).map(o => ({key:o.texture?.key, x:Math.round(o.x), y:Math.round(o.y), d:o.depth, vis:o.visible}));
})()`);
console.log(JSON.stringify(info));
await browser.close();
