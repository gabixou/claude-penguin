import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);
await p.mouse.move(150, 650);
await p.waitForTimeout(600);
await p.screenshot({ path: 'shots/clone-town-idle.png' });
// hover real na porta — world(348,169) -> screen(469,288)
await p.mouse.move(469, 288, { steps: 6 });
await p.waitForTimeout(900);
const st = await p.evaluate(() => {
    const s = window.__penguin.scene, m = s.movie;
    return {
        hovered: s._interactions.hovered,
        btn: m._buttonStates.get('background_mc.dance_btn_states.dance_btn'),
        canopy: m._playheads.get('dance_canopy_mc')?.frame,
        canopyStopped: m._playheads.get('dance_canopy_mc')?.stopped,
    };
});
console.log(JSON.stringify(st));
await p.screenshot({ path: 'shots/clone-town-hover.png' });
await p.waitForTimeout(700);
await p.screenshot({ path: 'shots/clone-town-hover2.png' });
await p.mouse.move(150, 650, { steps: 5 });
await p.waitForTimeout(700);
await p.screenshot({ path: 'shots/clone-town-out.png' });
await b.close();
