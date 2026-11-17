import { chromium } from 'playwright-core';
import fs from 'fs';
// Screenshots pós-worker: town e dance no clone.
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
fs.mkdirSync('tools/shots', { recursive: true });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tools/shots/clone-town-worker.png' });
await p.evaluate(() => window.__penguin.scene.changeRoom('dance', null, null));
await p.waitForFunction(() => {
    const s = window.__penguin.scene;
    return s.currentRoom === 'dance' && s._movieReady === true;
}, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tools/shots/clone-dance-worker.png' });
// volta pra town — revisita
await p.evaluate(() => window.__penguin.scene.changeRoom('town', null, null));
await p.waitForFunction(() => window.__penguin.scene.currentRoom === 'town' && window.__penguin.scene._movieReady === true, null, { timeout: 60000 });
await p.waitForTimeout(800);
await p.screenshot({ path: 'tools/shots/clone-town-revisit.png' });
console.log('pageerrors:', errs.length ? errs : 'none');
await b.close();
