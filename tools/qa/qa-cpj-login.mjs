// Login no CPJourney como arenovisk e inspeciona como os penguins sao
// renderizados (assets, requests, pipeline).
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const reqs = [];
page.on('request', (r) => { const u = r.url(); if (/\.(png|jpg|webp|svg|json|swf|mp3|bin|atlas)/i.test(u)) reqs.push(u.slice(0, 160)); });
page.on('console', (m) => { const t = m.text(); if (/error|fail/i.test(t)) console.log('[pg-err]', t.slice(0, 160)); });
await page.goto('https://play.cpjourney.net/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(8000);
console.log('URL:', page.url());
console.log('TITLE:', await page.title());
// dump forms/inputs
const inputs = await page.evaluate(`(() => [...document.querySelectorAll('input')].map(i => ({type:i.type,name:i.name,id:i.id,ph:i.placeholder})))()`);
console.log('INPUTS:', JSON.stringify(inputs));
const btns = await page.evaluate(`(() => [...document.querySelectorAll('button,a,input[type=submit]')].map(b => (b.innerText||b.value||'').trim()).filter(Boolean).slice(0,30))()`);
console.log('BTNS:', JSON.stringify(btns));
await page.screenshot({ path: 'tools/shots/cpj-login.png' });
console.log('REQS sample:', reqs.slice(0, 30).join('\n'));
await browser.close();
