import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
    const scene = window.__penguin.scene, m = scene.movie;
    const d = (scene._dynList || []).find(d => d.path.includes('dance_btn_states'));
    const b = m.dynBounds(d, scene._ss);
    // bounds por record separado
    const ch = m.characters['91'];
    const recBounds = {};
    // world matrix do botao: resolve via _entryBounds no sprite 92
    const sp = m.sprites['92'];
    const fr = sp.frames[0];
    const ents = Array.isArray(fr) ? fr : (fr.entries || []);
    const bb = m._boundsOfEntries(ents, { a: scene._ss, b: 0, c: 0, d: scene._ss, x: 0, y: 0 }, 'background_mc.dance_btn_states');
    return {
        ss: scene._ss,
        dynPath: d.path, dynWorld: d.world,
        dynBoundsDev: b,
        canvasWH: d.canvas ? [d.canvas.width, d.canvas.height] : null,
        oxoy: [d.ox, d.oy],
        frameBoundsDevPx: bb,
        imgPos: d.img ? [d.img.x, d.img.y, d.img.displayWidth, d.img.displayHeight] : null,
    };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
