import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.currentRoom === 'dance', null, { timeout: 90000 });
} catch { console.log('room:', await p.evaluate(() => window.__penguin?.scene?.currentRoom)); }
await p.waitForTimeout(1000);
// conta re-renders por overlay em ~3s (instrumenta renderSpriteDynamic)
const counts = await p.evaluate(async () => {
  const s = window.__penguin.scene, m = s.movie;
  const cnt = {};
  const orig = m.renderSpriteDynamic.bind(m);
  m.renderSpriteDynamic = (d, sc) => { cnt[d.path] = (cnt[d.path] || 0) + 1; return orig(d, sc); };
  await new Promise(r => setTimeout(r, 3000));
  return cnt;
});
console.log('re-renders por overlay em 3s:');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(' ', v, k);
// town tambem: hover no botao dance -> canopy deve re-renderizar (forced path)
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1000);
const town = await p.evaluate(async () => {
  const s = window.__penguin.scene, m = s.movie;
  const cnt = {};
  const orig = m.renderSpriteDynamic.bind(m);
  m.renderSpriteDynamic = (d, sc) => { cnt[d.path] = (cnt[d.path] || 0) + 1; return orig(d, sc); };
  // simula hover no dance_btn (gotoPath canopy over:2 + setButtonState)
  m.gotoPath('dance_canopy_mc', 2, true);
  m.setButtonState('background_mc.dance_btn', 'over');
  await new Promise(r => setTimeout(r, 800));
  m.gotoPath('dance_canopy_mc', 1, false);
  m.setButtonState('background_mc.dance_btn', 'up');
  await new Promise(r => setTimeout(r, 800));
  return cnt;
});
console.log('town forced re-renders:', JSON.stringify(town));
await b.close();
