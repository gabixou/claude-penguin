import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);
const info = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.igloo);
    const mgr = s.igloo;
    if (!mgr.isOwner) return { owner: false };
    mgr.toggleEditor();
    await new Promise(r => setTimeout(r, 3000));
    const ed = mgr.editor;
    const c = ed._cover;
    const cam = s.cameras.main;
    const vb = cam.worldView;
    // bounds em screen space via getBounds (retorna world) -> converte manualmente
    const toScreen = (wx, wy) => ({ x: (wx - cam.scrollX) * cam.zoom, y: (wy - cam.scrollY) * cam.zoom });
    const cb = c.getBounds();
    const cs = toScreen(cb.x, cb.y), ce = toScreen(cb.right, cb.bottom);
    // room art: primeiro image grande de fundo
    const roomImgs = s.children.list.filter(o => o.type === 'Image' && !o.scrollFactorX && o !== c).slice(0,5).map(o => ({key:o.texture?.key, x:o.x, y:o.y, w:o.displayWidth, h:o.displayHeight, sf:[o.scrollFactorX,o.scrollFactorY], d:o.depth}));
    const uiImgs = s.children.list.filter(o => o.type === 'Image' && o !== c).slice(0,12).map(o => ({key:o.texture?.key?.slice(0,40), x:Math.round(o.x), y:Math.round(o.y), w:Math.round(o.displayWidth), h:Math.round(o.displayHeight), sf:[o.scrollFactorX,o.scrollFactorY], d:o.depth}));
    return {
        coverWorld: { x: c.x, y: c.y, w: c.displayWidth, h: c.displayHeight, scrollFactor: [c.scrollFactorX, c.scrollFactorY] },
        coverScreen: { l: Math.round(cs.x), t: Math.round(cs.y), r: Math.round(ce.x), b: Math.round(ce.y) },
        cam: { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom, vw: cam.width, vh: cam.height, worldView: { x: vb.x, y: vb.y, w: vb.width, h: vb.height } },
        scale: { w: s.scale.width, h: s.scale.height },
        roomImgs, uiImgs,
    };
})()`);
console.log(JSON.stringify(info, null, 1));
await browser.close();
