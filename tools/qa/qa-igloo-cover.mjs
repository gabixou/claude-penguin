import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.igloo); })()`;
const info = await page.evaluate(`(async () => {
    const s = ${scene};
    const mgr = s.igloo;
    if (!mgr.isOwner) return { owner: false };
    mgr.toggleEditor();
    await new Promise(r => setTimeout(r, 3500));
    const ed = mgr.editor;
    const c = ed._cover;
    return {
        cover: c ? { x: c.x, y: c.y, w: c.displayWidth, h: c.displayHeight, scale: c.scaleX, depth: c.depth, texW: c.texture?.width, texH: c.texture?.height, origin: [c.originX, c.originY] } : null,
        cam: { scrollX: s.cameras.main.scrollX, scrollY: s.cameras.main.scrollY, zoom: s.cameras.main.zoom },
        objs: ed._objs?.length,
    };
})()`);
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'tools/shots/igloo-cover-debug.png' });
await browser.close();
