import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', m => { const t = m.text(); if (/warn|error/i.test(m.type()) || t.includes('[movie]') || t.includes('[dyn]')) console.log('CON[' + m.type() + ']', t.slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);

const state = () => p.evaluate(() => {
  const s = window.__penguin.scene;
  const layers = s.movieLayers || [];
  return {
    ready: !!s._movieReady,
    loader: !!s.loadingScreen?.visible,
    visLayers: layers.filter(l => l.img?.visible).length,
    totalLayers: layers.length,
    dynVisible: (s._dynList || []).filter(d => d.img?.visible).length,
    cardOpen: !!s.playerCard?.isOpen,
    camZoom: s.cameras.main.zoom,
    camScroll: [s.cameras.main.scrollX, s.cameras.main.scrollY],
  };
});
console.log('ANTES:', JSON.stringify(await state()));
// abre o player card do pinguim local
await p.evaluate(() => {
  const s = window.__penguin.scene;
  s.playerCard.open(s.localPlayer);
});
await p.waitForTimeout(500);
console.log('CARD+500ms:', JSON.stringify(await state()));
await p.waitForTimeout(2500);
console.log('CARD+3s:', JSON.stringify(await state()));
await b.close();
