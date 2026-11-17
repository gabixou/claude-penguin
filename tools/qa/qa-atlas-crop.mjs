// Crop do pinguim na tela para inspecao visual do atlas
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
// bounds do pinguim em coords de tela
const bb = await page.evaluate(`(() => {
    const s = ${scene};
    const p = s.localPlayer;
    const b = p.getBounds ? p.getBounds() : null;
    const cam = s.cameras.main;
    return b ? { x: b.x, y: b.y, w: b.width, h: b.height, scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom } : null;
})()`);
console.log('bounds:', JSON.stringify(bb));
// canvas rect p/ mapear mundo->tela (canvas 1039x551 exibindo 760x480? ou zoom)
const c = await page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
console.log('canvas:', JSON.stringify(c));
if (bb) {
    // tenta zoom na camera p/ screenshot mais detalhado
    await page.evaluate(`(() => { const s = ${scene}; s.cameras.main.setZoom(3); s.cameras.main.centerOn(${bb.x + bb.w/2}, ${bb.y + bb.h/2}); })()`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tools/shots/atlas-penguin-zoom.png' });
}
await browser.close();
