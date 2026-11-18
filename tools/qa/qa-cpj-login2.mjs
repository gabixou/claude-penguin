// Login CPJourney arenovisk — preenche form e entra no jogo.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const reqs = [];
page.on('request', (r) => { const u = r.url(); if (/penguin|cloth|paper|avatar|player|frame|pose|dance/i.test(u)) reqs.push(u.slice(0, 170)); });
await page.goto('https://play.cpjourney.net/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(9000);
// tenta preencher login
const filled = await page.evaluate(`(() => {
    const u = document.getElementById('2fainput');
    const p = document.getElementById('currentinput');
    if (!u || !p) return { err: 'no inputs', vis: [...document.querySelectorAll('input')].map(i=>({id:i.id,vis:i.offsetParent!==null})) };
    u.value = 'arenovisk'; u.dispatchEvent(new Event('input',{bubbles:true}));
    p.value = 'z2wtx$i4)9DF$Yi'; p.dispatchEvent(new Event('input',{bubbles:true}));
    return { ok: true, uVis: u.offsetParent!==null, pVis: p.offsetParent!==null };
})()`);
console.log('fill:', JSON.stringify(filled));
await page.screenshot({ path: 'tools/shots/cpj-filled.png' });
// procura botao de login / enter
const clicked = await page.evaluate(`(() => {
    const cands = [...document.querySelectorAll('button,a,div,span,input')];
    const b = cands.find(e => /log ?in|sign ?in|enter/i.test(e.innerText||e.value||'') && e.offsetParent);
    if (b) { b.click(); return b.innerText||b.value; }
    return null;
})()`);
console.log('clicked:', clicked);
await page.waitForTimeout(12000);
console.log('URL after:', page.url());
await page.screenshot({ path: 'tools/shots/cpj-after-login.png' });
console.log('PENGUIN REQS:', reqs.slice(0, 40).join('\n'));
await browser.close();
