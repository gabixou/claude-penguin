import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const urls = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const SS = 2, X0 = 340, Y0 = 160, W = 140, H = 50;
    const out = {};
    for (const l of m.topLevelLayers()) {
        const name = l.entry.name || ('L' + l.entry.depth);
        const lc = document.createElement('canvas');
        lc.width = 760 * SS; lc.height = 480 * SS;
        await m.renderLayer(l.entry, lc, SS);
        const c = document.createElement('canvas');
        c.width = W * SS * 3; c.height = H * SS * 3;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(lc, X0 * SS, Y0 * SS, W * SS, H * SS, 0, 0, W * SS * 3, H * SS * 3);
        out[name] = c.toDataURL('image/png');
    }
    return out;
});
for (const [k, v] of Object.entries(urls)) {
    if (v) fs.writeFileSync('shots/layer-' + k.replace(/[^a-z0-9]/gi, '_') + '.png', Buffer.from(v.split(',')[1], 'base64'));
}
console.log('saved', Object.keys(urls).length);
await b.close();
