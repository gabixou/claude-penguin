// Debug: bounds reais do selector/zones no editor de igloo.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.igloo); })()`;

// abre o editor (trena) se o player for dono
const open = await page.evaluate(`(async () => {
    const s = ${scene};
    const mgr = s.igloo;
    if (!mgr.isOwner) return { owner: false };
    mgr.toggleEditor();
    await new Promise(r => setTimeout(r, 3000));
    const ed = mgr.editor;
    ed._toggleSelector(true);
    await new Promise(r => setTimeout(r, 300));
    const sel = ed._selector;
    return {
        owner: true,
        editorOpen: ed.isOpen,
        sel: sel ? {
            x: +sel.x.toFixed(1), y: +sel.y.toFixed(1),
            w: +sel.displayWidth.toFixed(1), h: +sel.displayHeight.toFixed(1),
            scale: +sel.scaleX.toFixed(3), origin: [sel.originX, sel.originY],
        } : null,
        zones: ed._selectorZones.map(z => ({ x: z.x, y: z.y, w: z.displayWidth, h: z.displayHeight })),
        ctrls: ed._ctrls.map(c => ({ x: +c.x.toFixed(0), y: +c.y.toFixed(0), w: +c.displayWidth.toFixed(0), h: +c.displayHeight.toFixed(0) })),
        cam: { scrollX: s.cameras.main.scrollX, scrollY: s.cameras.main.scrollY, zoom: s.cameras.main.zoom },
    };
})()`);
console.log(JSON.stringify(open, null, 1));
await page.screenshot({ path: 'tools/shots/igloo-selector-debug.png' });
await browser.close();
