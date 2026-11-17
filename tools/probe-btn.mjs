import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('console', (m) => console.log('CON', m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
    const sc = window.__penguin.scene, m = sc.movie;
    const d = (sc._dynList || []).find((x) => x.path.includes('dance_btn_states'));
    if (!d) return { err: 'no dyn' };
    const h = m._playheads.get(d.path);
    const out = { path: d.path, frame: h?.frame, stopped: h?.stopped, sid: d.sid, ox: d.ox, oy: d.oy, cw: d.canvas.width, ch: d.canvas.height };
    // conta pixels do canvas atual
    const ctx = d.canvas.getContext('2d');
    const px = ctx.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    let ink = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 10) ink++;
    out.inkNow = ink;
    // re-render manual e conta de novo
    await m.renderSpriteDynamic(d, sc._ss);
    const px2 = ctx.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    let ink2 = 0; for (let i = 3; i < px2.length; i += 4) if (px2[i] > 10) ink2++;
    out.inkAfter = ink2;
    // bounds do dyn
    out.bounds = m.dynBounds(d, sc._ss);
    // o que o frame contem
    const tl = m.sprites[d.sid];
    const fr = tl.frames[h.frame - 1];
    const ents = Array.isArray(fr) ? fr : fr.entries;
    out.frameEntries = ents.map((e) => ({ id: e.id, name: e.name, depth: e.depth, m: e.matrix }));
    // skipDynamic contem o path do botao?
    out.skipHas = [...(m._skipDynamic || [])].filter((s) => s.includes('dance'));
    out.stateVis = m._state ? [...m._state.entries()].filter(([k]) => k.includes('dance')) : null;
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
