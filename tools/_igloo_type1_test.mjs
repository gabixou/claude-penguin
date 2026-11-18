import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1039, height: 551 } });
p.on('console', m => { const t = m.text(); if (/error|fail|igloo|warn/i.test(t)) console.log('[pg]', m.type(), t.slice(0, 200)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=igloo&penguin=Penguin Test', { waitUntil: 'domcontentloaded', timeout: 60000 });
let last = null;
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(2000);
  const s = await p.evaluate(() => {
    const g = window.__game;
    const sc = g && g.scene.scenes.find(x => x.currentRoom);
    if (!sc) return null;
    return {
      room: sc.currentRoom, ready: sc._movieReady, base: sc.movie?.base,
      type: sc.igloo?.layout?.iglooType, tid: sc._iglooTypeId,
      failed: sc._iglooTypeFailed ?? null,
      frames: sc.movie?.frames?.length ?? sc.movie?.frameCount ?? null,
      children: sc.children?.length ?? null,
    };
  });
  const sig = JSON.stringify(s);
  if (sig !== last) { console.log('T' + i * 2 + 's', sig); last = sig; }
  if (s?.ready && s.base?.includes('igloo-type')) { await p.waitForTimeout(10000); break; }
}
await p.screenshot({ path: 'shots/igloo-type1-test.png' });
await b.close();
process.exit(0);
