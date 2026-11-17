import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);

const state = () => p.evaluate(() => {
  const s = window.__penguin.scene;
  const pcTex = Object.keys(s.textures.list).filter(k => k.startsWith('playercard_'));
  return {
    ss: s._ss,
    visLayers: (s.movieLayers || []).filter(l => l.img?.visible).length,
    dynVis: (s._dynList || []).filter(d => d.img?.visible).length,
    pcTexCount: pcTex.length,
    totalTex: Object.keys(s.textures.list).length,
  };
});
console.log('BASE:', JSON.stringify(await state()));

// abre/fecha o card 3x — texturas nao devem acumular
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__penguin.scene.playerCard.close());
  await p.waitForTimeout(300);
}
console.log('APOS 3x CARD:', JSON.stringify(await state()));

// resize da janela -> ss muda -> layers devem re-renderizar e voltar visiveis
await p.setViewportSize({ width: 900, height: 600 });
await p.waitForTimeout(4000);
console.log('APOS RESIZE:', JSON.stringify(await state()));

// volta ao tamanho original
await p.setViewportSize({ width: 1280, height: 800 });
await p.waitForTimeout(4000);
console.log('RESIZE VOLTA:', JSON.stringify(await state()));
await b.close();
