import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
await page.evaluate(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    s.igloo.toggleEditor();
});
await page.waitForFunction(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    return !!s?.igloo?.editor?._saveBtn;
}, null, { timeout: 25000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(__dirname, 'shots/igloo-edit-full.png') });
await page.screenshot({ path: path.join(__dirname, 'shots/igloo-edit-br.png'),
    clip: { x: 700, y: 350, width: 339, height: 201 } });
await browser.close();
console.log('done');
