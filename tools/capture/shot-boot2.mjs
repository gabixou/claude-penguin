import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
// espera BootScene ficar ativo e clica screenshot imediatamente
await p.waitForFunction(() => window.__game?.scene?.isActive?.('BootScene'), null, { timeout: 60000, polling: 50 });
await p.waitForTimeout(250); // deixa create() rodar (logo+text+bar)
await p.screenshot({ path: 'tools/shots/clone-boot-loader.png', timeout: 30000 });
await b.close();
