import { chromium } from 'playwright-core';
// Mede tempo de _movieReady por transicao de sala.
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
const t0 = Date.now();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('town cold:', ((Date.now() - t0) / 1000).toFixed(2) + 's');

const go = async (room, label) => {
    const s = Date.now();
    await p.evaluate((r) => {
        const sc = window.__penguin.scene;
        sc._movieReady = false;
        sc.changeRoom(r);
    }, room);
    await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
    console.log(label + ':', ((Date.now() - s) / 1000).toFixed(2) + 's');
};

await go('dance', 'town->dance cold');
await go('town', 'dance->town revisit');
await go('dance', 'town->dance revisit');
await go('town', 'dance->town revisit2');
await b.close();
