import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const X0 = 350, Y0 = 170, X1 = 460, Y1 = 195, SS = 2;
    const out = [];
    for (const l of m.topLevelLayers()) {
        const name = l.entry.name || ('#' + l.entry.depth);
        const lc = document.createElement('canvas');
        lc.width = 760 * SS; lc.height = 480 * SS;
        await m.renderLayer(l.entry, lc, SS);
        const d = lc.getContext('2d').getImageData(X0 * SS, Y0 * SS, (X1 - X0) * SS, (Y1 - Y0) * SS).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) ink++;
        out.push({ name, id: l.entry.id, ink });
    }
    return out;
});
console.log(JSON.stringify(res));
await b.close();
