import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });

const res = await p.evaluate(async () => {
    const m = window.__penguin.scene.movie;
    const file = [...m.files.keys()].find(f => f.endsWith('.svg'));
    const svg = m._svgText(file);

    const variants = {
        orig: svg,
        // sem px nas dims
        nopx: svg.replace('height="4.35px" width="4.0px"', 'height="4.35" width="4.0"'),
        // sem ffdec namespace
        noffdec: svg.replace(/xmlns:ffdec="[^"]*"\s*/, '').replace(/\sffdec:objectType="[^"]*"/, ''),
        // viewBox + dims numericas
        vb: svg.replace(/<svg([^>]*)>/, (mm, a) => {
            const a2 = a.replace(/\s*(height|width)="[^"]*"/g, '');
            return `<svg${a2} width="4" height="4.35" viewBox="0 0 4 4.35">`;
        }),
        // so o path puro num svg minimo
        min: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4.35" viewBox="0 0 4 4.35"><path d="M0.0 -0.1 L0.0 0.25" fill="none" stroke="#ffffff" stroke-width="4.0"/></svg>',
    };

    const code = [
        'onmessage = async (e) => {',
        '  try {',
        '    const bmp = await createImageBitmap(new Blob([e.data.svg], {type:"image/svg+xml"}), {resizeWidth: e.data.w, resizeHeight: e.data.h});',
        '    const c = new OffscreenCanvas(bmp.width, bmp.height);',
        '    c.getContext("2d").drawImage(bmp, 0, 0);',
        '    const px = c.getContext("2d").getImageData(0, 0, bmp.width, bmp.height).data;',
        '    let ink = 0;',
        '    for (let i = 3; i < px.length; i += 4) if (px[i] > 10) ink++;',
        '    postMessage({ w: bmp.width, h: bmp.height, ink });',
        '  } catch (err) { postMessage({ error: String(err) }); }',
        '};'
    ].join('\n');
    const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    const out = {};
    for (const [name, s] of Object.entries(variants)) {
        out[name] = await new Promise((res) => {
            w.onmessage = (e) => res(e.data);
            w.onerror = (e) => res({ error: 'worker: ' + e.message });
            w.postMessage({ svg: s, w: 9, h: 10 });
        });
    }
    w.terminate();
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
