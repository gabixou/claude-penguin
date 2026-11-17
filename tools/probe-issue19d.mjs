import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(4000);
// IDLE state check
const idle = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return lp?.view ? { frame: lp.action, af: lp.view.animationFrame, ready: lp.view.frameReady(), drawn: lp.view.drawnFrame, items: lp.view.items.size } : null;
});
console.log('IDLE:', JSON.stringify(idle));
await p.screenshot({ path: 'tools/shots/issue19-idle.png' });
// dance
await p.evaluate(() => window.__penguin.scene.handleAction('dance'));
await p.waitForTimeout(500);
const d = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return { frame: lp.action, af: lp.view.animationFrame, ready: lp.view.frameReady(), drawn: lp.view.drawnFrame, items: lp.view.items.size };
});
console.log('DANCE early:', JSON.stringify(d));
// espera ficar ready e tira screenshot da pose completa
await p.waitForFunction(() => {
  const lp = window.__penguin.scene.localPlayer;
  return lp?.view?.frameReady() && lp.view.drawnFrame === lp.view.animationFrame;
}, null, { timeout: 30000 }).catch(() => console.log('ready timeout'));
await p.waitForTimeout(800);
const d2 = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return { frame: lp.action, af: lp.view.animationFrame, ready: lp.view.frameReady(), drawn: lp.view.drawnFrame, items: lp.view.items.size };
});
console.log('DANCE ready:', JSON.stringify(d2));
await p.screenshot({ path: 'tools/shots/issue19-dance-ready.png' });
// volta pro idle — verifica que retorna
await p.evaluate(() => window.__penguin.scene.handleAction('stand'));
await p.waitForTimeout(1200);
const st = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return { frame: lp.action, af: lp.view.animationFrame, ready: lp.view.frameReady(), drawn: lp.view.drawnFrame };
});
console.log('STAND:', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/issue19-stand.png' });
await b.close();
