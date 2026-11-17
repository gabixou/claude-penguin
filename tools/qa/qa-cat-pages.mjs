// QA catalogo: abre furn2008, vai p/ pag 2 e 3, screenshot; depois igloocat2008.
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
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);

const openCat = async (key, pg) => page.evaluate(async ({ key, pg }) => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    await scene.catalogue.open(key, { page: pg });
    await new Promise((r) => setTimeout(r, 3500));
    return { open: scene.catalogue.isOpen, key: scene.catalogue.key, page: scene.catalogue.page };
}, { key, pg });

for (const [key, pg, name] of [
    ['furn2008', 2, 'cat-furn-p2'],
    ['furn2008', 5, 'cat-furn-p5'],
    ['igloocat2008', 2, 'cat-igloo-p2'],
]) {
    const st = await openCat(key, pg);
    console.log(name, JSON.stringify(st));
    await page.screenshot({ path: path.join(__dirname, '..', 'shots/' + name + '.png') });
}
await browser.close();
console.log('done');