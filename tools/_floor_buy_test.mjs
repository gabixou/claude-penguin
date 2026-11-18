import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56'; // Penguin Test
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;
const READY = `(() => { const s = ${GETSC}; return s && s._playerReady && s._movieReady && s.localPlayer; })()`;

const b = await chromium.launch({ executablePath: EXE, headless: true });
const P = await b.newPage();
P.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 150)));
P.on('console', (m) => { const t = m.text(); if (/igloo|IGLOO|coin/i.test(t)) console.log('[pg]', t.slice(0, 140)); });
await P.goto(`http://localhost:3000/?token=${TOK_B}&room=igloo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await P.waitForFunction(() => window.__game, null, { timeout: 30000 });
await P.waitForFunction(READY, null, { timeout: 90000 });
await P.waitForTimeout(2500); // IGLOO_STATE + inventory

// abre o catalogue na aba flooring e clica BUY do Green Carpet (id 2)
const r = await P.evaluate(`(() => {
  const s = ${GETSC};
  const cat = s.iglooCatalogue;
  cat.open();
  cat.tab = 'flooring';
  cat._render();
  const inv = [...(cat._invByKind?.get('flooring') || [])];
  return { open: cat.isOpen, tab: cat.tab, floorOwned: inv };
})()`);
console.log('catalogo:', JSON.stringify(r));

// clica no botao de compra do flooring id=2 (Green Carpet)
const clicked = await P.evaluate(`(async () => {
  const s = ${GETSC};
  const cat = s.iglooCatalogue;
  // repinta e localiza o botao da linha do id 2
  cat.tab = 'flooring';
  await cat._render();
  const list = cat.el.querySelector('[data-r=list]');
  const rows = [...(list?.children || [])];
  let btn = null;
  for (const d of rows) {
    if (d.textContent && d.textContent.includes('Green Carpet')) {
      btn = d.querySelector('button');
      break;
    }
  }
  if (!btn) return 'not-found';
  const label = btn.textContent;
  btn.click();
  return label;
})()`);
console.log('botao clicado:', clicked);

await P.waitForTimeout(3000); // IGLOO_BUY -> INVENTORY -> auto-equip -> IGLOO_SAVE -> STATE
const after = await P.evaluate(`(() => {
  const s = ${GETSC};
  return {
    floor: s.igloo?.layout?.floor,
    pending: s.iglooCatalogue?._pendingEquip,
    floorOwned: [...(s.iglooCatalogue?._invByKind?.get('flooring') || [])],
  };
})()`);
console.log('depois:', JSON.stringify(after));
await P.screenshot({ path: 'tools/shots/igloo-floor-buy.png' });
await b.close();
process.exit(0);
