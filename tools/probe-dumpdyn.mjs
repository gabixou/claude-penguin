import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(2500);
const urls = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const out = {};
    for (const d of sc._dynList || []) {
        out[d.path] = {
            url: d.canvas ? d.canvas.toDataURL('image/png') : null,
            x: d.img ? d.img.x : null, y: d.img ? d.img.y : null,
            w: d.img ? d.img.width : null, h: d.img ? d.img.height : null,
            frame: sc.movie._playheads.get(d.path) ? sc.movie._playheads.get(d.path).frame : null,
        };
    }
    return out;
});
for (const [k, v] of Object.entries(urls)) {
    const safe = k.replace(/[^a-z0-9]/gi, '_');
    if (v.url) fs.writeFileSync('shots/dyn-' + safe + '.png', Buffer.from(v.url.split(',')[1], 'base64'));
    console.log(k, 'pos', v.x, v.y, 'size', v.w, 'x', v.h, 'frame', v.frame);
}
await b.close();
