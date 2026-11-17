import { chromium } from 'playwright-core';
// FPS em GPU real (headless:false) — idle e walk.
const URL = 'http://localhost:3000/?penguin=Arenovisk';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, args: ['--window-size=1280,800'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));

await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(3000); // warm arte

const measure = () => p.evaluate(() => new Promise((res) => {
    const deltas = [];
    let last = performance.now();
    const loop = (t) => {
        deltas.push(t - last); last = t;
        if (deltas.length < 240) requestAnimationFrame(loop);
        else {
            deltas.sort((a, b) => a - b);
            const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            res({ fps: +(1000 / avg).toFixed(1), p95: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1), max: +deltas[deltas.length - 1].toFixed(1) });
        }
    };
    requestAnimationFrame(loop);
}));

console.log('IDLE:', JSON.stringify(await measure()));
await p.evaluate(() => window.__penguin.scene.localPlayer?.moveTo(380, 300, 150));
await p.waitForTimeout(300);
console.log('WALK:', JSON.stringify(await measure()));
await b.close();
