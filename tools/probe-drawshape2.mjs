import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const ID = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
    const out = {};
    for (const cid of ['78', '80', '89']) {
        const ch = m.characters[cid];
        const c = document.createElement('canvas'); c.width = 300; c.height = 300;
        const ctx = c.getContext('2d');
        try {
            await m._drawShape(ctx, ch, { a: 2, b: 0, c: 0, d: 2, x: 20, y: 20 }, ID, 2);
            const d = ctx.getImageData(0, 0, 300, 300).data;
            let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) ink++;
            out[cid] = { ink, file: ch.file, size: ch.size };
        } catch (e) { out[cid] = { err: String(e) }; }
    }
    // drawEntries do record up — path 'test'
    const rec = m.characters['91'].records.up;
    const c2 = document.createElement('canvas'); c2.width = 300; c2.height = 300;
    const ctx2 = c2.getContext('2d');
    try {
        await m._drawEntries(ctx2, rec, { a: 1.5, b: 0, c: 0, d: 1.5, x: 20, y: 20 }, 'test', ID, 1.5, 1);
        const d2 = ctx2.getImageData(0, 0, 300, 300).data;
        let ink2 = 0; for (let i = 3; i < d2.length; i += 4) if (d2[i] > 10) ink2++;
        out.btnUp = { ink: ink2 };
    } catch (e) { out.btnUp = { err: String(e) }; }
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
