import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'mine';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('https://gopenguin.lol/?room=' + room, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
const btn = await p.$('button, [class*="play"], [class*="enter"]');
if (btn) { try { await btn.click({ timeout: 2000 }); await p.waitForTimeout(10000); } catch {} }
await p.screenshot({ path: 'tools/shots/ref-' + room + '.png', timeout: 90000 }).catch(e => console.log('shot fail', String(e).slice(0, 100)));
await b.close();
console.log('done');
