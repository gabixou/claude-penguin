import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.catalogue?.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
    const c = window.__penguin.scene.catalogue;
    const m = c.movie;
    const out = [];
    for (const pg of [1, 2, 3]) {
        m.goto('book', pg);
        await new Promise(r => setTimeout(r, 400));
        await c._render();
        const ctx = c.canvas.getContext('2d');
        const W = c.canvas.width, H = c.canvas.height;
        const GW = 48, GH = 30, rows = [];
        for (let gy = 0; gy < GH; gy++) {
            let row = '';
            for (let gx = 0; gx < GW; gx++) {
                const d = ctx.getImageData(Math.floor(gx*W/GW), Math.floor(gy*H/GH), Math.floor(W/GW), Math.floor(H/GH)).data;
                let r=0,g=0,bl=0,n=0;
                for (let i=0;i<d.length;i+=40){r+=d[i];g+=d[i+1];bl+=d[i+2];n++;}
                r=Math.round(r/n);g=Math.round(g/n);bl=Math.round(bl/n);
                // classifica: W branco, B azul ceu, D escuro, b marrom, o laranja, g verde, r vermelho, . cinza
                const mx=Math.max(r,g,bl), mn=Math.min(r,g,bl);
                let ch='.';
                if (mx>235&&mn>235) ch='W';
                else if (mx-mn<25) ch = mx>200?'w':mx>120?'.':'#';
                else if (bl>r&&bl>g) ch = bl>180?'B':'b';
                else if (r>200&&g>150&&bl<120) ch='O';
                else if (r>150&&g<100&&bl<100) ch='R';
                else if (g>r&&g>bl) ch='G';
                else if (r>g&&g>bl) ch='N'; // marrom/laranja escuro
                else ch='?';
                row += ch;
            }
            rows.push(row);
        }
        out.push({ pg, rows });
    }
    return out;
});
for (const o of r) { console.log('=== page', o.pg); console.log(o.rows.join('\n')); }
await b.close();
