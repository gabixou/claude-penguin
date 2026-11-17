import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene, m = sc.movie;
  const d = (sc._dynList || []).find(x => x.path.endsWith('dance_btn_states'));
  if (!d) return { err: 'no dyn' };
  const h = m._playhead(d.path, d.sid);
  const out = { path: d.path, sid: d.sid, frames: h.tl.frames.length, labels: h.tl.labels, acts: h.tl.frames.map((f,i)=>({f:i+1,a:m._actions(h.tl,i+1)})) };
  // bounds de cada frame
  const ss = sc._ss;
  const worldDev = { a: ss*d.world.a, b: ss*d.world.b, c: ss*d.world.c, d: ss*d.world.d, x: ss*d.world.x, y: ss*d.world.y };
  out.frameBounds = h.tl.frames.map((fr,i) => {
    const bb = m._boundsOfEntries(fr, worldDev, d.path);
    return { f: i+1, n: fr.length, bb: bb ? bb.map(Math.round) : null };
  });
  // render cada frame no canvas do dyn e salva dataURL
  const orig = h.frame;
  out.pngs = {};
  for (let f = 1; f <= h.tl.frames.length; f++) {
    h.frame = f;
    await m.renderSpriteDynamic(d, ss);
    out.pngs['f'+f] = d.canvas.toDataURL('image/png');
  }
  h.frame = orig;
  await m.renderSpriteDynamic(d, ss);
  return out;
});
const { pngs, ...meta } = r;
console.log(JSON.stringify(meta, null, 1));
for (const [k, u] of Object.entries(pngs || {})) {
  if (u.startsWith('data:')) fs.writeFileSync('shots/dbs-' + k + '.png', Buffer.from(u.split(',')[1], 'base64'));
}
await b.close();
