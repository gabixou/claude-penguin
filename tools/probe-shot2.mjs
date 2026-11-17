import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', m => { const t = m.text(); if (t.includes('movie') || t.includes('error') || t.includes('Error')) console.log('[' + m.type() + ']', t.slice(0, 250)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(75000);
// espera ate background canvas pintado + texture refreshed
await p.evaluate(() => new Promise(res => {
  const s = window.__penguin.scene;
  const check = () => {
    const l = s.movieLayers && s.movieLayers[0];
    if (!l) return setTimeout(check, 500);
    const d = l.canvas.getContext('2d').getImageData(500, 100, 10, 10).data;
    let painted = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) painted++;
    if (painted > 5) return res(true);
    setTimeout(check, 500);
  };
  check();
}));
// mais 2s para refresh propagar
await p.waitForTimeout(2000);
const game = await p.evaluate(() => window.__penguin.scene.game);
await p.evaluate(() => window.__penguin.scene.game.loop.sleep());
await p.waitForTimeout(800);
await p.screenshot({ path: 'tools/shots/clone-town.png', timeout: 90000 });
console.log('shot saved');
await b.close();
