import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
} catch { console.log('movieReady timeout'); }
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const lp = s.localPlayer;
  if (!lp?.view) return { err: 'no localPlayer/view', room: s.currentRoom };
  return {
    room: s.currentRoom,
    look: lp.gpaOutfit,
    frame: lp.action,
    af: lp.view.animationFrame,
    items: [...lp.view.items.keys()],
    drawnFrame: lp.view.drawnFrame
  };
});
console.log('IDLE:', JSON.stringify(info));
// dispara dance
await p.evaluate(() => window.__penguin.scene.handleAction('dance'));
await p.waitForTimeout(400);
const d1 = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return { frame: lp.action, af: lp.view.animationFrame, drawn: lp.view.drawnFrame,
    itemFrames: [...lp.view.items.entries()].map(([k, it]) => ({ slot: k, mframes: it.m?.data?.main?.frames?.length })) };
});
console.log('DANCE t+0.4:', JSON.stringify(d1));
await p.screenshot({ path: 'tools/shots/issue19-dance-1.png' });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'tools/shots/issue19-dance-2.png' });
const d2 = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return { frame: lp.action, af: lp.view.animationFrame, drawn: lp.view.drawnFrame };
});
console.log('DANCE t+1.6:', JSON.stringify(d2));
await p.waitForTimeout(2000);
await p.screenshot({ path: 'tools/shots/issue19-dance-3.png' });
await b.close();
