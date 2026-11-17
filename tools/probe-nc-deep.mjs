import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(async () => {
    const scene = window.__penguin.scene;
    const m = scene.movie;
    const inter = scene._interactions;
    const dance = inter.buttons.find(b => b.path.includes('dance_btn'));
    const [x0, y0, x1, y1] = dance.bounds;
    inter.hoverAt((x0 + x1) / 2, (y0 + y1) / 2);
    // espera renders async
    await new Promise(r => setTimeout(r, 800));
    const snap = () => {
        const out = { state: m._buttonStates.get(dance.path) };
        const ph = m._playheadsAll instanceof Map ? [...m._playheadsAll.entries()] : Object.entries(m._playheadsAll || {});
        out.ph = {};
        for (const [k, v] of ph) if (/dance_btn|canopy|#132|nightclub/.test(k)) out.ph[k] = { f: v.frame, stopped: v.stopped };
        return out;
    };
    const out = {};
    out.t0 = snap();
    await new Promise(r => setTimeout(r, 700));
    out.t1 = snap();
    await new Promise(r => setTimeout(r, 700));
    out.t2 = snap();
    // overlay dance_btn_states: canvas + ink
    const dyns = scene._dynList || [];
    const d = dyns.find(d => d.path.includes('dance_btn_states'));
    out.dyn = d ? { path: d.path, canvas: d.canvas ? [d.canvas.width, d.canvas.height] : null, ox: d.ox, oy: d.oy, hasImg: !!d.img } : 'NOT FOUND';
    if (d?.canvas) {
        const c = d.canvas.getContext('2d');
        const data = c.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
        let ink = 0; const rows = {};
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 30) { ink++; const y = ((i / 4 / d.canvas.width) | 0); rows[y] = (rows[y] || 0) + 1; }
        out.dyn.ink = ink;
        out.dyn.rowRange = [Math.min(...Object.keys(rows).map(Number)), Math.max(...Object.keys(rows).map(Number))];
        // salva canvas como dataURL pra inspecao
        out.dyn.dataUrl = d.canvas.toDataURL('image/png');
    }
    return out;
});
console.log(JSON.stringify({ ...r, dyn: r.dyn ? { ...r.dyn, dataUrl: undefined } : r.dyn }, null, 1));
if (r.dyn?.dataUrl) {
    const fs = await import('fs');
    fs.writeFileSync('shots/dyn-dancebtn-over.png', Buffer.from(r.dyn.dataUrl.split(',')[1], 'base64'));
    console.log('saved dyn-dancebtn-over.png');
}
await p.screenshot({ path: 'shots/nc-hover2.png' });
await b.close();
