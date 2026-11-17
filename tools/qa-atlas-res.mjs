import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
await page.evaluate(`(() => { const s = ${scene}; s.handleAction('dance'); })()`);
await page.waitForTimeout(8000);
const res = await page.evaluate(`(() => {
    const e = performance.getEntriesByType('resource').map(r => r.name).filter(u => u.includes('atlas'));
    const byBase = {};
    for (const u of e) { const m = u.split('/assets/')[1]?.split('/chars/')[0] || u; byBase[m] = (byBase[m]||0)+1; }
    return { total: e.length, byBase, sample: e.slice(0,8) };
})()`);
console.log(JSON.stringify(res, null, 1));
await browser.close();
