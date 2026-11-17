import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('https://gopenguin.lol/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
// tenta achar o botao de buddy no HUD (canvas — clica por coordenada se necessario)
// primeiro: dump de elementos clicaveis/DOM
const info = await p.evaluate(() => {
    const els = [...document.querySelectorAll('div,button,img,canvas')].slice(0, 60).map((e) => ({
        tag: e.tagName, id: e.id, cls: (e.className || '').toString().slice(0, 60),
        txt: (e.textContent || '').trim().slice(0, 30),
    }));
    return { title: document.title, url: location.href, count: els.length, els: els.filter(e => e.txt || e.id || e.cls).slice(0, 40) };
});
console.log(JSON.stringify(info, null, 1).slice(0, 4000));
await p.screenshot({ path: 'tools/shots/gp-home.png' });
await b.close();
