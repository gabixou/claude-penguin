// QA compra igloo: abre furn2008, clica BUY de um item, aceita prompt, verifica inventario.
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

const r = await page.evaluate(async () => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    const cat = scene.catalogue;
    const net = scene.network;
    const out = { coins: net?.coins, ws: net?.isConnected };
    await cat.open('furn2008', { page: 2 });
    await new Promise((r) => setTimeout(r, 3500));
    // primeiro controle de compra furniture
    const b = cat.controls.find((c) => c._buyKind === 'furniture' && c._itemId);
    out.buy = b ? { id: b._itemId, kind: b._buyKind, bounds: b.bounds, label: b.label } : null;
    if (b) {
        const [x0, y0, x1, y1] = b.bounds;
        cat.clickAt((x0 + x1) / 2, (y0 + y1) / 2);
        await new Promise((r) => setTimeout(r, 2500));
        out.promptOpen = cat.promptOpen;
        // aceita Yes: emite pointerdown na zone do yes_btn
        const cont = cat._prompt?.cont;
        out.promptKids = cont?.list?.length;
        if (cont) {
            // zones sao Phaser Zone interativos — dispara pointerdown no primeiro (yes esta depois do swallow)
            const zones = cont.list.filter((o) => o.input);
            zones[zones.length - 2]?.emit?.('pointerdown'); // yes_btn (antes do no_btn/ok)
            await new Promise((r) => setTimeout(r, 2500));
        }
        out.invAfter = (scene.igloo?.inventory || []).length;
        out.notice = !!cat._prompt?.isOpen;
    }
    return out;
});
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: path.join(__dirname, 'shots/cat-buy.png') });
await browser.close();
console.log('done');