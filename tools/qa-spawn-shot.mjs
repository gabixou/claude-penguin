import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 1500));
await p.screenshot({ path: 'tools/shots/clone-spawn-town.png' });
// troca de sala para validar spawn
await p.evaluate(() => { const s = window.__penguin.scene; s.changeRoom('coffee'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'coffee', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 1200));
await p.screenshot({ path: 'tools/shots/clone-spawn-coffee.png' });
const r = await p.evaluate(() => { const s = window.__penguin.scene; return { room: s.currentRoom, x: s.localPlayer.x, y: s.localPlayer.y, valid: s.movie?.isValidSpawn?.(s.localPlayer.x, s.localPlayer.y) }; });
console.log(JSON.stringify(r));
await b.close();
