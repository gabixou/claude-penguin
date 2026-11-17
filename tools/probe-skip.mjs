import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const urls = await p.evaluate(async () => {
  const sc = window.__penguin.scene, m = sc.movie;
  const ss = sc._ss;
  const main = m._mainTl.frames[0] || [];
  const out = {};
  for (const nm of ['block_mc', 'triggers_mc', 'foreground_mc']) {
    const e = main.find(x => x.name === nm);
    if (!e) { out[nm] = 'missing'; continue; }
    const saved = m._skipDynamic;
    m._skipDynamic = null;
    const c = document.createElement('canvas');
    c.width = Math.ceil(760 * ss); c.height = Math.ceil(480 * ss);
    await m.renderLayer(e, c, ss);
    m._skipDynamic = saved;
    out[nm] = c.toDataURL('image/png');
  }
  return out;
});
for (const [k, u] of Object.entries(urls)) {
  if (typeof u === 'string' && u.startsWith('data:')) fs.writeFileSync('shots/top-' + k + '.png', Buffer.from(u.split(',')[1], 'base64'));
  else console.log(k, u);
}
console.log('done');
await b.close();
