import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
// pagina 4: secret DEVE ficar oculto estavel — screenshots a cada 700ms
await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue;
    cat.open('furn2008_catalogue');
    await new Promise(r2 => setTimeout(r2, 6000));
    cat.movie.goto('book', 4);
    await cat._show();
})()`);
await page.waitForTimeout(1500);
const frames = [];
for (let i = 0; i < 6; i++) {
    const f = await page.evaluate(`(() => { const g = window.__game||window.game; const s = Object.values(g.scene.keys).find(x=>x.catalogue); return s.catalogue.movie.currentFrame('secret'); })()`);
    frames.push(f);
    await page.screenshot({ path: `tools/shots/furn-p4-stable-${i}.png` });
    await page.waitForTimeout(700);
}
console.log('p4 secret frames over ~4s:', frames.join(','));
// pagina 7: mesmo teste
await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue;
    cat.movie.goto('book', 7);
    await cat._show();
    await new Promise(r2 => setTimeout(r2, 1500));
})()`);
const f7 = await page.evaluate(`(() => { const g = window.__game||window.game; const s = Object.values(g.scene.keys).find(x=>x.catalogue); const c=s.catalogue; return { cf: c.movie.currentFrame('secret'), ctrls: c.controls.filter(x=>x.path.includes('secret')).map(x=>x.label) }; })()`);
console.log('p7:', JSON.stringify(f7));
// clica no trigger da p7 (procurar controle com release nextFrame)
const t7 = await page.evaluate(`(() => { const g = window.__game||window.game; const s = Object.values(g.scene.keys).find(x=>x.catalogue); const c=s.catalogue; const t=c.controls.find(x=>x.release&&x.release.includes('nextFrame')); return t?{p:t.path,b:t.bounds,l:t.label}:null; })()`);
console.log('p7 trigger:', JSON.stringify(t7));
if (t7) {
    await page.evaluate(`(async (b) => { const g=window.__game||window.game; const s=Object.values(g.scene.keys).find(x=>x.catalogue); s.catalogue.clickAt((b[0]+b[2])/2,(b[1]+b[3])/2); await new Promise(r=>setTimeout(r,900)); })([${t7.b}])`);
    const after = await page.evaluate(`(() => { const g=window.__game||window.game; const s=Object.values(g.scene.keys).find(x=>x.catalogue); return s.catalogue.movie.currentFrame('secret'); })()`);
    console.log('p7 apos click secret frame:', after);
    await page.screenshot({ path: 'tools/shots/furn-p7-secret.png' });
}
await browser.close();
