import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.catalogue?.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
    const c = window.__penguin.scene.catalogue;
    const m = c.movie;
    const sample = async (pg) => {
        m.goto('book', pg);
        await new Promise(r => setTimeout(r, 400));
        await c._render();
        const ctx = c.canvas.getContext('2d');
        const W = c.canvas.width, H = c.canvas.height;
        const avg = (fx0, fy0, fx1, fy1) => {
            const d = ctx.getImageData(Math.floor(fx0*W), Math.floor(fy0*H), Math.floor((fx1-fx0)*W), Math.floor((fy1-fy0)*H)).data;
            let r=0,g=0,bl=0,n=0;
            for (let i=0;i<d.length;i+=16){r+=d[i];g+=d[i+1];bl+=d[i+2];n++;}
            return [Math.round(r/n),Math.round(g/n),Math.round(bl/n)];
        };
        return {
            pg,
            left: avg(0.28,0.35,0.45,0.65),
            right: avg(0.55,0.35,0.75,0.65),
            top: avg(0.4,0.1,0.6,0.25),
        };
    };
    const out = [];
    for (const pg of [1,2,3,4,5]) out.push(await sample(pg));
    return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
