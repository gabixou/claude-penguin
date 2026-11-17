import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    // regiao do "texto" em mundo: x 350-445, y 215-240
    const X0 = 350, Y0 = 215, X1 = 445, Y1 = 240, SS = 2;
    const out = [];
    for (const l of m.topLevelLayers()) {
        const name = l.entry.name || ('#' + l.entry.depth);
        const lc = document.createElement('canvas');
        lc.width = 760 * SS; lc.height = 480 * SS;
        await m.renderLayer(l.entry, lc, SS);
        const ctx = lc.getContext('2d');
        const d = ctx.getImageData(X0 * SS, Y0 * SS, (X1 - X0) * SS, (Y1 - Y0) * SS).data;
        let ink = 0, bright = 0;
        for (let i = 0; i < d.length; i += 4) {
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
            if (d[i + 3] > 40 && lum > 60) ink++;
            if (d[i + 3] > 40 && lum > 150) bright++;
        }
        out.push({ name, id: l.entry.id, ink, bright });
    }
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
