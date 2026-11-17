import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.waitForTimeout(1500);
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
// clique real no clothing_btn (centro ~702,436)
await p.mouse.click(rect.l + (702/760)*rect.w, rect.t + (436/480)*rect.h);
// loading deve aparecer
await p.waitForTimeout(600);
const loading = await p.evaluate(() => !!window.__penguin.scene.loadingScreen?.visible);
console.log('loading visivel:', loading);
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(500);
const st = await p.evaluate(() => ({ open: window.__penguin.scene.catalogue.isOpen, key: window.__penguin.scene.catalogue.key, page: window.__penguin.scene.catalogue.page, controls: window.__penguin.scene.catalogue.controls.length }));
console.log('catalogo:', JSON.stringify(st));
await p.screenshot({ path: 'shots/shop-cat-open.png' });
await b.close();
