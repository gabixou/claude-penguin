// Perf: tempo do _furnitureTexture (primeira mobília) com atlas vs sem
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(25000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo' && s.igloo); })()`;
const r = await page.evaluate(`(async () => {
    const s = ${scene};
    if (!s?.igloo) return { err: 'no igloo mgr' };
    const t0 = performance.now();
    const t = await s.igloo._furnitureTexture('1', 1, 1);
    const t1 = performance.now();
    // segunda mobília diferente (cache de pack separado)
    const t2p = performance.now();
    const t2 = await s.igloo._furnitureTexture('100', 1, 1);
    const t3 = performance.now();
    return { chair: +(t1 - t0).toFixed(0), chair100: +(t3 - t2p).toFixed(0), ok: !!t, ok2: !!t2, w: t?.w, h: t?.h };
})()`);
console.log(JSON.stringify(r));
await browser.close();
