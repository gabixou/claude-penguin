import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const bad = [];
p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000/minigames/pufflescape/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const g = window.game;
  return { hasGame: !!g, active: g ? g.scene.getScenes(true).map(s => s.scene.key) : null, tex: g ? Object.keys(g.textures.list).length : 0 };
});
console.log(JSON.stringify({ r, bad, errs: errs.slice(0,3) }, null, 1));
await b.close();
