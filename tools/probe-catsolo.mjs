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
    m.goto('book', 2);
    await new Promise(r => setTimeout(r, 300));
    // entries top-level do frame 2 (index 1)
    const frame = m._mainTl.frames[1];
    const paths = frame.map(e => m._path('', e));
    const sample = async () => {
        await c._render();
        const ctx = c.canvas.getContext('2d');
        const W = c.canvas.width, H = c.canvas.height;
        // regiao da pagina direita do livro (world ~ x 420-580, y 150-340 -> fração)
        const d = ctx.getImageData(Math.floor(0.56*W), Math.floor(0.33*H), Math.floor(0.2*W), Math.floor(0.35*H)).data;
        let r=0,g=0,bl=0,n=0,dark=0;
        for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];bl+=d[i+2];n++;if(d[i]<100&&d[i+1]<100&&d[i+2]<100)dark++;}
        return { avg:[Math.round(r/n),Math.round(g/n),Math.round(bl/n)], darkPct: Math.round(100*dark/n) };
    };
    const out = { all: await sample(), solo: {} };
    for (const p of paths) {
        for (const q of paths) m.set(q, { visible: q === p ? true : false });
        // re-set visiveis true de novo depois
        out.solo[p] = await sample();
    }
    for (const q of paths) m.set(q, { visible: true });
    return { paths, out };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
