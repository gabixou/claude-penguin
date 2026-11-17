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
// estado UP primeiro
await p.evaluate(() => {
    const m = window.__penguin.scene.movie;
    m.setButtonState('background_mc.dance_btn_states.dance_btn', 'up');
});
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/v-up.png' });
// forca OVER
await p.evaluate(() => {
    const m = window.__penguin.scene.movie;
    m.setButtonState('background_mc.dance_btn_states.dance_btn', 'over');
});
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/v-over.png' });
// checa canvas do overlay nesse momento
const info = await p.evaluate(() => {
    const scene = window.__penguin.scene, m = scene.movie;
    const d = (scene._dynList || []).find(d => d.path.includes('dance_btn_states'));
    const c = d.canvas.getContext('2d');
    const data = c.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 30) ink++;
    return { ink, busy: d._busy, texKey: d.texKey, imgVisible: d.img?.visible, imgAlpha: d.img?.alpha, state: m._buttonStates.get('background_mc.dance_btn_states.dance_btn') };
});
console.log(JSON.stringify(info));
await b.close();
