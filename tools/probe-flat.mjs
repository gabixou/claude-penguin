import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(1000);
const url = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const W = 760, H = 480, SS = 1;
    const c = document.createElement('canvas');
    c.width = W * SS; c.height = H * SS;
    const ctx = c.getContext('2d');
    // renderiza cada top-level layer inteira na ordem (sem segmentacao)
    for (const l of m.topLevelLayers()) {
        const lc = document.createElement('canvas');
        lc.width = W * SS; lc.height = H * SS;
        await m.renderLayer(l.entry, lc, SS);
        ctx.drawImage(lc, 0, 0);
    }
    return c.toDataURL('image/png');
});
fs.writeFileSync('shots/town-flat.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('saved town-flat.png');
await b.close();
