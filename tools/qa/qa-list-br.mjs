import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
await page.evaluate(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    s.igloo.toggleEditor();
});
await page.waitForFunction(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    return !!s?.igloo?.editor?._saveBtn;
}, null, { timeout: 25000 });
const list = await page.evaluate(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
    const out = [];
    s.children.list.forEach((o) => {
        if (!o.visible) return;
        const b = o.getBounds ? o.getBounds() : null;
        if (!b) return;
        // regiao inferior direita do mundo (x>560, y>300)
        if (b.right > 560 && b.bottom > 300 && b.left < 760 && b.top < 480) {
            out.push({
                type: o.type, tex: o.texture?.key, x: Math.round(o.x), y: Math.round(o.y),
                w: Math.round(o.displayWidth || b.width), h: Math.round(o.displayHeight || b.height),
                depth: o.depth,
            });
        }
    });
    return out.sort((a, b) => b.depth - a.depth).slice(0, 25);
});
console.log(JSON.stringify(list, null, 1));
await browser.close();