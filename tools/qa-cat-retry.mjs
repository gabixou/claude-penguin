import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 250)); });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
for (const key of ['furn2008', 'igloocat2008', 'furn2008']) {
    const r = await page.evaluate(async (key) => {
        const g = window.__game || window.game;
        const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
        const t0 = Date.now();
        await s.catalogue.open(key);
        return { key, ms: Date.now() - t0, open: s.catalogue.isOpen, catKey: s.catalogue.key,
                 controls: s.catalogue.controls?.length, movie: !!s.catalogue.movie };
    }, key);
    console.log(JSON.stringify(r));
    await page.waitForTimeout(500);
}
await browser.close();
console.log('done');