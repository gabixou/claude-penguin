import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=town&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const r1 = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { canRename: s.network?.canRename, hasModal: !!s.nameChangeModal, sameInstance: s.playerCard?.nameChangeModal === s.nameChangeModal };
});
console.log('pre:', JSON.stringify(r1));
// abre o card do proprio pinguim
await p.evaluate(() => { const s = window.__penguin.scene; s.playerCard.open(s.localPlayer); });
await p.waitForTimeout(4000);
const r2 = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const cont = s.playerCard.container;
  if (!cont) return { err: 'no card' };
  // conta containers filhos — o lapis e um container com 2 graphics
  let pencil = null;
  cont.each((ch) => {
    if (ch.type === 'Container' && ch.list && ch.list.length === 2 && ch.list.every(c => c.type === 'Graphics')) pencil = ch;
  });
  return { cardOpen: true, pencilFound: !!pencil };
});
console.log('card:', JSON.stringify(r2));
// clica no lapis
await p.evaluate(() => {
  const s = window.__penguin.scene;
  const cont = s.playerCard.container;
  cont.each((ch) => {
    if (ch.type === 'Container' && ch.list && ch.list.length === 2 && ch.list.every(c => c.type === 'Graphics') && ch.input) {
      ch.emit('pointerdown', { x: 0, y: 0 });
    }
  });
});
await p.waitForTimeout(1000);
const r3 = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const m = s.nameChangeModal;
  return {
    modalOpen: m.isOpen,
    hasInput: !!document.querySelector('input'),
    modalDepth: m.container ? m.container.depth : null,
  };
});
console.log('modal:', JSON.stringify(r3));
await p.screenshot({ path: 'tools/shots/rename-modal.png' });
await b.close();
