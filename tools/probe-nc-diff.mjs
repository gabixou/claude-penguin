import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
    const scene = window.__penguin.scene, m = scene.movie;
    const d = (scene._dynList || []).find(d => d.path.includes('dance_btn_states'));
    const grab = () => {
        const c = d.canvas.getContext('2d');
        return c.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    };
    // forca up, espera render
    m.setButtonState('background_mc.dance_btn_states.dance_btn', 'up');
    await new Promise(r => setTimeout(r, 900));
    const up = grab();
    m.setButtonState('background_mc.dance_btn_states.dance_btn', 'over');
    await new Promise(r => setTimeout(r, 900));
    const over = grab();
    // diff
    let n = 0; const bbox = [1e9, 1e9, -1, -1];
    for (let i = 0; i < up.length; i += 4) {
        const diff = Math.abs(up[i] - over[i]) + Math.abs(up[i + 1] - over[i + 1]) + Math.abs(up[i + 2] - over[i + 2]) + Math.abs(up[i + 3] - over[i + 3]);
        if (diff > 60) {
            n++;
            const px = (i / 4) % d.canvas.width, py = ((i / 4) / d.canvas.width) | 0;
            bbox[0] = Math.min(bbox[0], px); bbox[1] = Math.min(bbox[1], py);
            bbox[2] = Math.max(bbox[2], px); bbox[3] = Math.max(bbox[3], py);
        }
    }
    // estado do playhead sprite 88
    const h88 = m._playheads.get('background_mc.dance_btn_states.dance_btn#1');
    return { diffPx: n, bbox, f88: h88?.frame, stopped88: h88?.stopped, state: m._buttonStates.get('background_mc.dance_btn_states.dance_btn') };
});
console.log(JSON.stringify(r));
await b.close();
