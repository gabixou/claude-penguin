import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await p.waitForTimeout(900);
await p.screenshot({ path: 'tools/shots/clone-boot-loader.png', timeout: 60000 });
await b.close();
