import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(3000);
// anda um pouco para ver o pinguim em movimento + nametag
await p.evaluate(() => { const lp = window.__penguin.scene.localPlayer; lp.moveTo(lp.x + 140, lp.y - 30, 150); });
await p.waitForTimeout(700);
await p.screenshot({ path: 'tools/shots/clone-guestfix-town.png' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tools/shots/clone-guestfix-town2.png' });
await b.close();
