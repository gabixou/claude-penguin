const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => { if (/igloo|error/i.test(m.text())) console.log('[pg]', m.text().slice(0,200)); });
  await page.goto('http://localhost:3000/?room=igloo&guest=1', { waitUntil: 'domcontentloaded' });
  // guest=1 cria pinguim novo — preciso do Arenovisk. Melhor: login local via ?penguin=
  await page.waitForTimeout(3000);
  const state1 = await page.evaluate(() => ({
    room: window.__scene?.currentRoom,
    base: window.__scene?.movie?.base,
    iglooType: window.__scene?.igloo?.layout?.iglooType,
    typeId: window.__scene?._iglooTypeId,
  }));
  console.log('STATE1', JSON.stringify(state1));
  await page.waitForTimeout(8000);
  const state2 = await page.evaluate(() => ({
    base: window.__scene?.movie?.base,
    iglooType: window.__scene?.igloo?.layout?.iglooType,
    typeId: window.__scene?._iglooTypeId,
    ready: window.__scene?._movieReady,
  }));
  console.log('STATE2', JSON.stringify(state2));
  await browser.close();
})();
