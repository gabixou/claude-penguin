import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const urls = await p.evaluate(async () => {
  const sc = window.__penguin.scene, m = sc.movie;
  const d = (sc._dynList || []).find(x => x.path.endsWith('nightclubsign_mc'));
  if (!d) return { err: 'no dyn' };
  const h = m._playhead(d.path, d.sid);
  const orig = h.frame;
  const out = {};
  for (let f = 1; f <= h.tl.frames.length; f++) {
    h.frame = f;
    await m.renderSpriteDynamic(d, sc._ss);
    out['f' + f] = d.canvas.toDataURL('image/png');
  }
  h.frame = orig;
  await m.renderSpriteDynamic(d, sc._ss);
  d.tex?.refresh();
  return out;
});
for (const [k, u] of Object.entries(urls)) {
  if (typeof u === 'string' && u.startsWith('data:')) fs.writeFileSync('shots/sign-' + k + '.png', Buffer.from(u.split(',')[1], 'base64'));
}
console.log(Object.keys(urls));
await b.close();
