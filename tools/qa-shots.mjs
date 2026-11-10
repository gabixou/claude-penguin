import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// clone
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('CLONE PAGEERROR:', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(20000);
await p.screenshot({ path: 'tools/shots/clone-town.png', timeout: 120000 });
console.log('clone shot ok');
await p.close();

// reference
const r = await b.newPage({ viewport: { width: 1280, height: 720 } });
await r.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await r.waitForTimeout(15000);
await r.screenshot({ path: 'tools/shots/ref-town.png', timeout: 120000 });
console.log('ref shot ok');
await b.close();
