import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
for (const id of ['89', '82', '83', '84', '85', '86', '87']) {
    const svg = fs.readFileSync(`shots/ov-${id}.svg`, 'utf8');
    const b64 = Buffer.from(svg).toString('base64');
    await p.setContent(`<body style="margin:0;background:#334"><img src="data:image/svg+xml;base64,${b64}" style="width:400px"></body>`);
    await p.waitForTimeout(120);
    const el = await p.$('img');
    await el.screenshot({ path: `shots/ov-${id}.png` });
}
await b.close();
console.log('done');
