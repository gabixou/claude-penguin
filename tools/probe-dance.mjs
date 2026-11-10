import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
// espera sala carregar (muda para dance se o param nao pegar)
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.currentRoom === 'dance', null, { timeout: 90000 });
} catch {
  console.log('timeout dance, currentRoom=', await p.evaluate(() => window.__penguin?.scene?.currentRoom));
}
await p.waitForTimeout(2000);
const res = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const dyns = (s._dynList || []).map((d, i) => {
    if (!d.canvas) return { i, path: d.path, sid: d.sid, canvas: false };
    const ctx = d.canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    let alpha = 0;
    for (let k = 3; k < data.length; k += 4) if (data[k] > 10) alpha++;
    const h = [...m._playheads.entries()].find(([k]) => k === d.path || k.endsWith('.' + d.path))?.[1];
    return {
      i, path: d.path, sid: d.sid, w: d.canvas.width, h: d.canvas.height,
      alphaPx: alpha, stopped: h?.stopped, frame: h?.frame,
      frames: m.sprites[d.sid]?.frames?.length,
    };
  });
  // sprites animados na sala que NAO viraram overlay
  const skipped = m._skipDynamic || new Set();
  const missed = [];
  const walk = (entries, path) => {
    for (const e of entries || []) {
      const cp = m._path(path, e);
      const sid = String(e.id);
      if (m.sprites[sid]) {
        if ((m.sprites[sid].frames?.length || 1) > 1 && !skipped.has(cp)) missed.push(cp + ' sid' + sid);
        walk(m.sprites[sid].frames?.[0] || [], cp);
      } else {
        const ch = m.characters[sid];
        if (ch?.kind === 'button') walk(ch.records?.up || [], cp);
      }
    }
  };
  for (const l of m.topLevelLayers()) walk([l.entry], '');
  return { room: s.currentRoom, dynCount: dyns.length, dyns, missed };
});
console.log('room:', res.room, 'dynCount:', res.dynCount);
for (const d of res.dyns) console.log(JSON.stringify(d));
console.log('MISSED (anim sem overlay):', res.missed.length);
for (const x of res.missed.slice(0, 30)) console.log(' ', x);
await b.close();
