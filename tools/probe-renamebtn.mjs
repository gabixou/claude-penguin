import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  await scene.playerCard.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 2000));
  const pc = scene.playerCard;
  let zone = null;
  pc.container.each((o) => { if (o.name === 'pcard_rename') zone = o; });
  if (!zone) return { ok: false, reason: 'no zone' };
  zone.emit('pointerdown');
  await new Promise(r => setTimeout(r, 500));
  return {
    ok: true,
    modalOpen: !!scene.nameChangeModal?.isOpen,
    canRename: scene.network?.canRename,
  };
});
console.log(JSON.stringify(r));
await b.close();
