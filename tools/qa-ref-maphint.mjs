import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
// abre o mapa (tecla M ou botao) — tenta clicar no botao MAP do HUD
await p.keyboard.press('m').catch(() => {});
await p.waitForTimeout(3000);
await p.screenshot({ path: 'shots/ref-map.png' });
// se o mapa abriu, passa o mouse sobre o centro (uma sala)
await p.mouse.move(640, 300, { steps: 10 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/ref-map-hover.png' });
await p.mouse.move(500, 350, { steps: 10 });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/ref-map-hover2.png' });
await b.close();
