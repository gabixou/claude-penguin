import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(2500);
// pega bounds reais do dance_btn
const btn = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const list = sc._interactions?.buttons || [];
    const d = list.find((x) => x.path.includes('dance_btn'));
    return d ? { path: d.path, bounds: d.bounds } : null;
});
console.log('dance_btn:', JSON.stringify(btn));
const scale = 1024 / 760, offY = 60;
const cx = ((btn.bounds[0] + btn.bounds[2]) / 2) * scale;
const cy = offY + ((btn.bounds[1] + btn.bounds[3]) / 2) * scale;
console.log('hover screen', cx, cy);
await p.screenshot({ path: 'shots/h2-idle.png' });
await p.mouse.move(cx, cy, { steps: 6 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/h2-hover.png' });
await p.waitForTimeout(2000);
await p.screenshot({ path: 'shots/h2-hover2.png' });
await p.mouse.move(cx - 250, cy + 150, { steps: 8 });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/h2-out.png' });
// estado do botao depois
const st = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    return { hovered: sc._interactions?.hovered, btnState: sc.movie._buttonStates.get('background_mc.dance_btn_states.dance_btn') };
});
console.log('state:', JSON.stringify(st));
await b.close();
