import { chromium } from 'playwright-core';
// Slide pos-fix: anda CEDO e mede se drawnFrame acompanha frame
// (se drawn ficar para tras = slide/espera de decode).
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
// espera o view do pinguim local existir (setLook ja rodou -> prefetch disparado)
await p.waitForFunction(() => {
    const lp = window.__penguin?.scene?.localPlayer;
    return lp?.view && lp.view.drawnFrame > 0;
}, null, { timeout: 30000 });

const t0 = Date.now();
await p.evaluate(() => {
    const s = window.__penguin.scene;
    const lp = s.localPlayer;
    lp.moveTo(lp.x + 400, lp.y - 200, 150); // walk longo p/ observar varios frames
});

let last = '';
for (let i = 0; i < 60; i++) {
    const s = await p.evaluate(() => {
        const lp = window.__penguin.scene.localPlayer;
        const v = lp?.view;
        const lib = window.__penguin.scene.penguinLibrary;
        let imgs = 0;
        if (lib?.movie?._imgCache) imgs = lib.movie._imgCache.size;
        return v ? {
            t: performance.now() | 0,
            action: lp.action, frame: v.frame, drawn: v.drawnFrame,
            af: v.animationFrame, rendering: lp._rendering, imgs,
            x: lp.x | 0, y: lp.y | 0,
        } : null;
    });
    if (!s) break;
    const lag = s.drawn - s.frame; // drawn atras do frame = slide
    const line = `+${((s.t - t0) / 1000).toFixed(1)}s act=${s.action} f=${s.frame} drawn=${s.drawn} af=${s.af} lag=${lag} rend=${s.rendering} imgs=${s.imgs} pos=${s.x},${s.y}`;
    if (line !== last) { console.log(line); last = line; }
    await p.waitForTimeout(120);
}
await b.close();
