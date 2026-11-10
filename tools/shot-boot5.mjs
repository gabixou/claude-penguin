import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
// espera BootScene + create() ter rodado (preload ~300ms + margem)
await p.waitForFunction(() => window.__game?.scene?.isActive?.('BootScene'), null, { timeout: 60000, polling: 100 });
await p.waitForTimeout(900);
const st = await p.evaluate(() => ({ boot: window.__game?.scene?.isActive?.('BootScene') }));
console.log('state', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/clone-boot-loader.png', timeout: 30000 });
await b.close();
