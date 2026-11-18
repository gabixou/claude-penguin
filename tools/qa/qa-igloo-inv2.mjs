import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo&penguin=Penguin_ZDNT', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.igloo && x.igloo.editor !== undefined);
    const mgr = s.igloo;
    mgr.toggleEditor();
    await new Promise(r2 => setTimeout(r2, 3000));
    await mgr.editor._openGridview(null);
    await new Promise(r2 => setTimeout(r2, 6000));
})()`);
await page.screenshot({ path: 'tools/shots/igloo-inv-grid2.png' });
await browser.close();
