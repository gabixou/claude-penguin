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
    const scene = window.__penguin.scene;
    // coleta imgs de segmentos e overlays com depth e bounds mundo
    const items = [];
    for (const seg of scene.movieLayers || []) {
        if (!seg.img) continue;
        items.push({ kind: 'seg', depth: seg.img.depth, x: seg.img.x, y: seg.img.y, w: seg.img.displayWidth, h: seg.img.displayHeight, vis: seg.img.visible });
    }
    for (const d of scene._dynList || []) {
        if (!d.img) continue;
        items.push({ kind: 'dyn:' + d.path.split('.').pop(), depth: d.img.depth, x: d.img.x, y: d.img.y, w: d.img.displayWidth, h: d.img.displayHeight, vis: d.img.visible });
    }
    // regiao door world ~(370-450, 105-205)
    const inRegion = items.filter(i => i.x - i.w / 2 < 450 && i.x + i.w / 2 > 370 && i.y - i.h / 2 < 205 && i.y + i.h / 2 > 105);
    inRegion.sort((a, b) => a.depth - b.depth);
    return inRegion;
});
console.log(JSON.stringify(r, null, 0));
await b.close();
