import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });

const res = await p.evaluate(async () => {
    const m = window.__penguin.scene.movie;
    const out = {};
    // testa 3 arquivos: shape pequeno, medio, sprite composto
    const files = [...m.files.keys()].filter(f => f.endsWith('.svg')).slice(0, 3);
    for (const file of files) {
        const ch = m.characters[Object.keys(m.characters).find(k => m.characters[k].file === file)];
        const img = await m._svgImage(file);
        if (!img) { out[file] = 'no img'; continue; }
        const cw = Math.ceil((ch?.size?.[0] || 20) * 2.25), chh = Math.ceil((ch?.size?.[1] || 20) * 2.25);
        try {
            const t0 = performance.now();
            const bmp = await createImageBitmap(img, { resizeWidth: cw, resizeHeight: chh });
            const ms = +(performance.now() - t0).toFixed(1);
            // conta pixels de tinta
            const c = new OffscreenCanvas(bmp.width, bmp.height);
            const cx = c.getContext('2d');
            cx.drawImage(bmp, 0, 0);
            const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;
            let ink = 0;
            for (let i = 3; i < px.length; i += 4) if (px[i] > 10) ink++;
            out[file] = { natural: [img.naturalWidth, img.naturalHeight], bmp: [bmp.width, bmp.height], expected: [cw, chh], ink, ms };
            bmp.close?.();
        } catch (e) { out[file] = 'ERR ' + e; }
    }
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
