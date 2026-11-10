import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
// troca para coffee_shop e verifica posição após movie pronto
await p.evaluate(() => { const s = window.__penguin.scene; s.changeRoom('coffee_shop'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'coffee_shop', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 500));
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return {
    room: s.currentRoom,
    pos: { x: s.localPlayer.x, y: s.localPlayer.y },
    valid: s.movie?.isValidSpawn?.(s.localPlayer.x, s.localPlayer.y),
    pending: s._pendingSpawn
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
