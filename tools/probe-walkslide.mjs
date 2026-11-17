import { chromium } from 'playwright-core';
// Slide do walk: mede decode dos SVGs do pinguim/roupas apos entrar na sala.
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('town ready — iniciando walk imediato');

// anda imediatamente (como o usuario)
await p.evaluate(() => {
    const s = window.__penguin.scene;
    const lp = s.localPlayer;
    lp.moveTo(lp.x + 120, lp.y, 150);
});

// amostra caches: penguin base + roupas do look
const snap = () => p.evaluate(async () => {
    const s = window.__penguin.scene;
    const lib = s.penguinLibrary;
    const out = { bases: {} };
    const M = s.movie?.constructor;
    if (M?._sharedAssets) {
        for (const [base, entry] of M._sharedAssets) {
            const name = base.split('/').pop();
            if (!/penguin|clothing|^\d+$/.test(name)) continue;
            try {
                const sh = await entry;
                out.bases[name] = { files: sh.files.size, imgs: sh.imgCache.size };
            } catch {}
        }
    }
    // estado do walk do pinguim local
    const lp = s.localPlayer;
    out.walk = lp?.view ? {
        action: lp.action, frame: lp.view.frame, drawn: lp.view.drawnFrame,
        animFrame: lp.view.animationFrame, rendering: lp._rendering,
    } : null;
    return out;
});

for (let t = 0; t <= 30; t += 5) {
    const s = await snap();
    const rel = Object.entries(s.bases).filter(([k]) => ['penguin', 'town'].includes(k) || /^\d+$/.test(k));
    console.log(`t+${t}s`, JSON.stringify(rel), 'walk:', JSON.stringify(s.walk));
    if (t < 30) await p.waitForTimeout(5000);
}
await b.close();
