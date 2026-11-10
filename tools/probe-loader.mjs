import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
// screenshot durante o loading (antes do movieReady)
await p.waitForTimeout(3000);
await p.screenshot({ path: 'tools/shots/loader-vector.png' });
// espera o jogo carregar
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await b.close();
