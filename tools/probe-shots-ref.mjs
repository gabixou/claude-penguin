import { chromium } from 'playwright-core';
import fs from 'fs';
// Referencias gopenguin.lol
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
fs.mkdirSync('tools/shots', { recursive: true });
for (const room of ['town', 'dance']) {
    try {
        const resp = await p.goto(`https://gopenguin.lol/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await p.waitForTimeout(9000);
        await p.screenshot({ path: `tools/shots/ref-${room}-worker.png` });
        console.log(room, 'status', resp?.status());
    } catch (e) { console.log(room, 'FAIL', String(e).slice(0, 120)); }
}
await b.close();
