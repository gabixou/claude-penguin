// QA igloo: abre editor, abre catalogo furn2008, screenshot.
// Uso: node tools/qa-igloo-cat.mjs
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
await page.screenshot({ path: path.join(__dirname, '..', 'shots/igloo-pre.png') });

const openEditor = await page.evaluate(() => {
    const g = window.__game || window.game;
    const scene = g?.scene?.keys ? Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo') : null;
    if (!scene?.igloo) return 'no igloo manager';
    scene.igloo.toggleEditor?.();
    return 'toggled';
});
console.log('editor:', openEditor);
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(__dirname, '..', 'shots/igloo-editor.png') });

const ed = await page.evaluate(() => {
    const g = window.__game || window.game;
    const scene = g?.scene?.keys ? Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo') : null;
    const e = scene?.igloo?.editor;
    return {
        isOpen: e?.isOpen,
        ctrls: e?._ctrls?.length,
        items: e?.placement?.length,
        cover: !!e?._cover,
        selector: !!e?._selector,
    };
});
console.log('editor state:', JSON.stringify(ed));

// abre catalogo furn2008 direto (botao Buy Items chama o mesmo open)
const catState = await page.evaluate(async () => {
    const g = window.__game || window.game;
    const scene = g?.scene?.keys ? Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo') : null;
    await scene?.catalogue?.open('furn2008');
    await new Promise((r) => setTimeout(r, 4000));
    const c = scene?.catalogue;
    return { open: c?.isOpen, key: c?.key, page: c?.page, movie: !!c?.movie };
});
console.log('catalog state:', JSON.stringify(catState));
await page.screenshot({ path: path.join(__dirname, '..', 'shots/igloo-catalog.png') });
await browser.close();
console.log('done');