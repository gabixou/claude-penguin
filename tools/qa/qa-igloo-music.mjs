import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('console', m => { if (m.type() === 'error' || m.text().includes('igloo')) console.log('[pg]', m.text().slice(0, 200)); });
await page.goto('http://localhost:3000/?room=igloo&penguin=Penguin_ZDNT', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
const r = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.igloo && x.igloo.editor !== undefined);
    const mgr = s.igloo;
    if (!mgr?.isOwner) return { err: 'not owner' };
    mgr.toggleEditor();
    await new Promise(r2 => setTimeout(r2, 3000));
    const ed = mgr.editor;
    if (!ed?.isOpen) return { err: 'editor not open' };
    await ed._openMusic();
    await new Promise(r2 => setTimeout(r2, 5000));
    const w = ed._musicWin;
    return { open: !!w, hasImg: !!w?.img, zones: w?.zones?.length ?? -1,
             visible: w?.img?.visible };
})()`);
console.log(JSON.stringify(r));
await page.screenshot({ path: 'tools/shots/igloo-music-win.png' });
await browser.close();
