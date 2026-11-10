import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.catalogue?.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(2500);
// paths dos entries masked do frame 2: depths 7,19,24 -> '#7','#19','#24'
for (const hide of ['#7', '#19', '#24', null]) {
    const r = await p.evaluate(async (hide) => {
        const c = window.__penguin.scene.catalogue;
        const m = c.movie;
        m.goto('book', 2);
        await new Promise(r => setTimeout(r, 200));
        for (const h of ['#7', '#19', '#24']) m.set(h, { visible: true });
        if (hide) m.set(hide, { visible: false });
        await new Promise(r => setTimeout(r, 200));
        await c._render();
        return hide;
    }, hide);
    await p.screenshot({ path: `tools/shots/bisect-${hide || 'all'}.png` });
    console.log('shot', r);
}
await b.close();
