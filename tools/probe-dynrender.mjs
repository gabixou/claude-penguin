import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const d = (sc._dynList || []).find((x) => x.path.includes('dance_btn_states'));
    const h = m._playheads.get(d.path);
    const frame = h.tl.frames[h.frame - 1] || [];
    const ents = Array.isArray(frame) ? frame : frame.entries;
    const ID = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
    const out = { dynWorld: d.world, ss: sc._ss, ox: d.ox, oy: d.oy, cw: d.canvas.width, ch: d.canvas.height, nEnts: ents.length };
    // replica exata do renderSpriteDynamic
    const sm = { a: sc._ss, b: 0, c: 0, d: sc._ss, x: 0, y: 0 };
    function mul(m1, m2) { return [m1[0]*m2[0]+m1[2]*m2[1], m1[1]*m2[0]+m1[3]*m2[1], m1[0]*m2[2]+m1[2]*m2[3], m1[1]*m2[2]+m1[3]*m2[3], m1[0]*m2[4]+m1[2]*m2[5]+m1[4], m1[1]*m2[4]+m1[3]*m2[5]+m1[5]]; }
    const worldDev = mul(sm, d.world);
    out.worldDev = worldDev;
    // desenha num canvas grande sem translate pra ver onde cai
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const ctx = c.getContext('2d');
    try {
        await m._drawEntries(ctx, ents, worldDev, d.path, ID, sc._ss, 1);
        const dd = ctx.getImageData(0, 0, 800, 600).data;
        let ink = 0, minx = 1e9, miny = 1e9, maxx = 0, maxy = 0;
        for (let y = 0; y < 600; y++) for (let x = 0; x < 800; x++) {
            const i = (y * 800 + x) * 4;
            if (dd[i + 3] > 10) { ink++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
        }
        out.bigInk = ink; out.bigBounds = ink ? [minx, miny, maxx, maxy] : null;
    } catch (e) { out.err = String(e); }
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
