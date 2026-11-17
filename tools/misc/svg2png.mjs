import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
for (const id of ['39', '40', '41', '42', '43', '33', '34', '35']) {
    const svg = fs.readFileSync(`shots/sign-${id}.svg`, 'utf8');
    const b64 = Buffer.from(svg).toString('base64');
    await p.setContent(`<body style="margin:0;background:#223"><img src="data:image/svg+xml;base64,${b64}" style="image-rendering:auto;width:600px"></body>`);
    await p.waitForTimeout(150);
    const el = await p.$('img');
    await el.screenshot({ path: `shots/sign-${id}.png` });
}
await b.close();
console.log('done');
