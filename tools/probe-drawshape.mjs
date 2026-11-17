import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => { const t = m.text(); if (t.includes('seg') || t.includes('dyn') || t.includes('movie')) console.log('CON', t.slice(0, 250)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const out = {};
    // desenha shape 78 e 80 direto num canvas
    for (const cid of ['78', '80']) {
        const ch = m.characters[cid];
        const c = document.createElement('canvas'); c.width = 200; c.height = 200;
        const ctx = c.getContext('2d');
        try {
            await m._drawShape(ctx, ch, { a: 2, b: 0, c: 0, d: 2, x: 10, y: 10 }, [1, 0, 0, 1, 0, 0], 2);
            const d = ctx.getImageData(0, 0, 200, 200).data;
            let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) ink++;
            out[cid] = { ink, file: ch.file, size: ch.size };
        } catch (e) { out[cid] = { err: String(e) }; }
    }
    // tenta _drawEntries do record up do botao 91
    const btn = m.characters['91'];
    const rec = btn.records.up;
    const c2 = document.createElement('canvas'); c2.width = 300; c2.height = 300;
    const ctx2 = c2.getContext('2d');
    try {
        await m._drawEntries(ctx2, rec, { a: 1.5, b: 0, c: 0, d: 1.5, x: 20, y: 20 }, 'test', [1, 0, 0, 1, 0, 0], 1.5, 1);
        const d2 = ctx2.getImageData(0, 0, 300, 300).data;
        let ink2 = 0; for (let i = 3; i < d2.length; i += 4) if (d2[i] > 10) ink2++;
        out.btnUp = { ink: ink2 };
    } catch (e) { out.btnUp = { err: String(e) }; }
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
