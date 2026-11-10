import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0,120)));
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(12000);
await p.screenshot({ path: 'shots/gp-town.png' });
// tenta abrir inventario: tecla I ou botao
await p.keyboard.press('i').catch(()=>{});
await p.waitForTimeout(2000);
await p.screenshot({ path: 'shots/gp-wd1.png' });
console.log('title:', await p.title(), 'errs:', errs.slice(0,3));
await b.close();
