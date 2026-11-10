import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const ls = window.__penguin.scene.loadingScreen;
  return !ls || !ls.visible;
}, null, { timeout: 180000 }).catch(() => {});

// clica para destravar autoplay e checa o audio
await p.mouse.click(640, 400);
await p.waitForTimeout(1500);
const st = await p.evaluate(() => {
  const audios = [...document.querySelectorAll('audio')];
  return audios.map(a => ({ src: a.src.split('/').slice(-2).join('/'), paused: a.paused, vol: a.volume, dur: a.duration, err: a.error?.code }));
});
console.log('town audio:', JSON.stringify(st));

// troca para coffee via API da cena
await p.evaluate(() => window.__penguin.scene.changeRoom('coffee', 380, 312));
await p.waitForTimeout(3000);
const st2 = await p.evaluate(() => [...document.querySelectorAll('audio')].map(a => ({ src: a.src.split('/').slice(-2).join('/'), paused: a.paused, vol: a.volume, dur: a.duration })));
console.log('coffee audio:', JSON.stringify(st2));

// volta pra town
await p.evaluate(() => window.__penguin.scene.changeRoom('town', 380, 312));
await p.waitForTimeout(2000);
const st3 = await p.evaluate(() => [...document.querySelectorAll('audio')].map(a => ({ src: a.src.split('/').slice(-2).join('/'), paused: a.paused })));
console.log('town again:', JSON.stringify(st3));
await b.close();
