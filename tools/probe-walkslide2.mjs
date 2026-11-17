import { chromium } from 'playwright-core';
// Slide do walk v2: walk longo + amostragem de drawnFrame vs action a cada 500ms.
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('town ready — walk longo imediato');
await p.evaluate(() => {
    const s = window.__penguin.scene;
    const lp = s.localPlayer;
    lp.moveTo(lp.x + 300, lp.y - 60, 150); // ~2.4s de walk
});
for (let i = 0; i < 24; i++) {
    const s = await p.evaluate(() => {
        const lp = window.__penguin.scene.localPlayer;
        return lp?.view ? { a: lp.action, f: lp.view.frame, d: lp.view.drawnFrame, af: lp.view.animationFrame, r: lp._rendering, mv: lp.isMoving } : null;
    });
    console.log(`t=${(i * 0.5).toFixed(1)}s`, JSON.stringify(s));
    await p.waitForTimeout(500);
}
await b.close();
