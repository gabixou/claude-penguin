import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const dump = () => p.evaluate(() => {
  const room = window.penguinRoom, m = room.movie;
  const ph = m.playheads;
  const keys = ph instanceof Map ? [...ph.keys()] : Object.keys(ph || {});
  const find = (frag) => {
    const out = {};
    const entries = ph instanceof Map ? [...ph.entries()] : Object.entries(ph || {});
    for (const [k, v] of entries) if (k.includes(frag)) out[k] = v.frame ?? v;
    return out;
  };
  return {
    hovered: room.hovered,
    cam: { ...window.penguinCamera },
    canopy: find('canopy'),
    dancebtn: find('dance_btn'),
    phCount: keys.length,
    phSample: keys.slice(0, 15),
  };
});
console.log('IDLE', JSON.stringify(await dump()));
// hover — varre uma grade ao redor do door pra achar o hit real
for (const [sx, sy] of [[460, 270], [460, 300], [430, 280], [490, 280], [460, 240]]) {
  await p.mouse.move(sx, sy, { steps: 3 });
  await p.waitForTimeout(500);
  const d = await dump();
  console.log('at', sx, sy, '-> hovered:', JSON.stringify(d.hovered), 'canopy:', JSON.stringify(d.canopy));
  if (d.hovered) break;
}
await p.screenshot({ path: 'shots/gpC-hover.png' });
await b.close();
