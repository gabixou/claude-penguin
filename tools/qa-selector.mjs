// QA selector: abre editor, abre furniture_selector, screenshot.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/?room=igloo';

const browser = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
await page.evaluate(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    scene.igloo.toggleEditor();
});
// espera o open() async terminar (_selector so existe no fim)
await page.waitForFunction(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    return !!scene?.igloo?.editor?._selector;
}, null, { timeout: 20000 });
await page.evaluate(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    scene.igloo.editor._toggleSelector(true);
});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(__dirname, 'shots/igloo-selector.png') });
const info = await page.evaluate(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    const e = scene.igloo.editor;
    const img = e._selector;
    return img ? { x: img.x, y: img.y, w: img.displayWidth, h: img.displayHeight, vis: img.visible } : null;
});
console.log('selector:', JSON.stringify(info));
await browser.close();
console.log('done');