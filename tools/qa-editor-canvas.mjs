import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await p.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(9000);
await p.evaluate(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    s.igloo.toggleEditor();
});
await p.waitForFunction(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    return !!s?.igloo?.editor?._cover;
}, null, { timeout: 25000 });
await p.waitForTimeout(400);
const c = await p.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await p.screenshot({ path: path.join(__dirname, 'shots/igloo-edit-canvas.png'),
    clip: { x: c.x, y: c.y, width: c.w, height: c.h } });
console.log('clip', JSON.stringify(c));
await browser.close();
console.log('done');