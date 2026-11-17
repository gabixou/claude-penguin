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
    const ch = m.characters[Object.keys(m.characters).find(k => m.characters[k].file === file)];
    const out = { file, svgHead: svg.slice(0, 160), charSize: ch?.size };

    const code = [
        'onmessage = async (e) => {',
        '  const d = e.data;',
        '  try {',
        '    let bmp;',
        '    if (d.mode === "resize") {',
        '      bmp = await createImageBitmap(new Blob([d.svg], {type:"image/svg+xml"}), {resizeWidth: d.w, resizeHeight: d.h});',
        '    } else {',
        '      const s2 = d.svg.replace(/<svg([^>]*)>/, (mm, attrs) => {',
        '        const a = attrs.replace(/\\s(width|height)="[^"]*"/g, "");',
        '        return "<svg" + a + " width=\\"" + d.w + "\\" height=\\"" + d.h + "\\">";',
        '      });',
        '      bmp = await createImageBitmap(new Blob([s2], {type:"image/svg+xml"}));',
        '    }',
        '    const c = new OffscreenCanvas(bmp.width, bmp.height);',
        '    const cx = c.getContext("2d");',
        '    cx.drawImage(bmp, 0, 0);',
        '    const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;',
        '    let ink = 0;',
        '    for (let i = 3; i < px.length; i += 4) if (px[i] > 10) ink++;',
        '    postMessage({ w: bmp.width, h: bmp.height, ink });',
        '  } catch (err) { postMessage({ error: String(err) }); }',
        '};'
    ].join('\n');

    const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    const cw = Math.ceil((ch?.size?.[0] || 20) * 2.25), chh = Math.ceil((ch?.size?.[1] || 20) * 2.25);
    for (const mode of ['resize', 'inject']) {
        const r = await new Promise((res) => {
            w.onmessage = (e) => res(e.data);
            w.postMessage({ svg, w: cw, h: chh, mode });
        });
        out[mode] = r;
    }
    w.terminate();
    return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
