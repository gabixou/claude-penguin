import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.currentRoom === 'dance', null, { timeout: 90000 });
} catch { console.log('room:', await p.evaluate(() => window.__penguin?.scene?.currentRoom)); }
await p.waitForTimeout(2000);
await p.screenshot({ path: 'shots/dance-withdyn.png' });

// re-renderiza todas as layers SEM skipDynamic (comportamento antigo)
await p.evaluate(async () => {
  const s = window.__penguin.scene, m = s.movie;
  m._skipDynamic = new Set();
  for (const d of s._dynList || []) d.img?.setVisible(false);
  for (const layer of s.movieLayers) {
    await m.renderLayer(layer.entry, layer.canvas, s._ss);
    layer.tex?.refresh();
    await new Promise(r => setTimeout(r, 0));
  }
});
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/dance-nodyn.png' });
await b.close();
console.log('done');
