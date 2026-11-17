import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (t.includes('[seg]') || t.includes('[dyn]') || t.includes('[movie]')) console.log('CON', t.slice(0, 200)); } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const town = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return {
    segs: (s.movieLayers || []).length,
    dyns: (s._dynList || []).length,
    segInfo: (s.movieLayers || []).map(g => ({ w: g.canvas?.width, h: g.canvas?.height, ops: g.ops?.length, vis: g.img?.visible, depth: +g.depth?.toFixed(5) })),
  };
});
console.log('TOWN segs:', town.segs, 'dyns:', town.dyns);
for (const g of town.segInfo) console.log(' ', JSON.stringify(g));
// dance
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.currentRoom === 'dance', null, { timeout: 90000 });
} catch { console.log('room:', await p.evaluate(() => window.__penguin?.scene?.currentRoom)); }
await p.waitForTimeout(2000);
const dance = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { segs: (s.movieLayers || []).length, dyns: (s._dynList || []).length };
});
console.log('DANCE segs:', dance.segs, 'dyns:', dance.dyns);
// cove
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=cove', { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.currentRoom === 'cove', null, { timeout: 90000 });
} catch { console.log('room:', await p.evaluate(() => window.__penguin?.scene?.currentRoom)); }
await p.waitForTimeout(1500);
const cove = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { segs: (s.movieLayers || []).length, dyns: (s._dynList || []).length };
});
console.log('COVE segs:', cove.segs, 'dyns:', cove.dyns);
await b.close();
