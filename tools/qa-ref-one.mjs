import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('https://gopenguin.lol/?room=' + room, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(20000);
console.log('title:', await p.title(), 'url:', p.url());
const btn = await p.$('button, [class*="play"], [class*="enter"]');
console.log('btn:', !!btn);
if (btn) { try { await btn.click({ timeout: 3000 }); await p.waitForTimeout(8000); } catch (e) { console.log('click fail', String(e).slice(0, 80)); } }
try { await p.screenshot({ path: 'shots/ref-' + room + '.png', timeout: 60000 }); console.log('shot ok'); }
catch (e) { console.log('shot fail', String(e).slice(0, 120)); }
await b.close();
