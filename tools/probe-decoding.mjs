import { chromium } from 'playwright-core';
// P7.1: prefetch de decode em idle para salas adjacentes.
// town -> espera idle prefetch -> dance: _movieReady deve cair bem abaixo do cold.
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('town ready');

// helper: imgCache.size por base (decode prefetch progresso)
const cacheSizes = () => p.evaluate(async () => {
    const M = window.__penguin.scene.movie.constructor;
    const out = {};
    for (const [base, entry] of M._sharedAssets) {
        try {
            const s = await entry;
            out[base.split('/').pop()] = { files: s.files.size, imgs: s.imgCache.size };
        } catch { out[base.split('/').pop()] = 'err'; }
    }
    return out;
});

// amostra a cada 10s ate 70s — ver decode prefetch trabalhar
for (let t = 10; t <= 70; t += 10) {
    await p.waitForTimeout(10000);
    const cs = await cacheSizes();
    const interesting = Object.entries(cs).filter(([k, v]) => v !== 'err' && v.imgs > 0);
    console.log(`t+${t}s decoded-bases:`, JSON.stringify(interesting));
    // para quando dance tiver ~todos imgs (786 files) ou timeout
    const d = cs['movies/dance'] || cs['dance'];
    if (d && typeof d === 'object' && d.imgs >= d.files * 0.9) { console.log('dance decode ~complete'); break; }
}

const t0 = Date.now();
await p.evaluate(() => window.__penguin.scene.changeRoom('dance', null, null));
await p.waitForFunction(() => {
    const s = window.__penguin.scene;
    return s.currentRoom === 'dance' && s._movieReady === true;
}, null, { timeout: 120000 });
console.log('town -> dance (pos-prefetch):', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('pageerrors:', errs.length ? errs : 'none');
await b.close();
