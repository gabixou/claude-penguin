import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const room = window.penguinRoom, cam = window.penguinCamera;
  const out = { cam: { ...cam } };
  out.buttons = (room.buttons || []).map(b => ({ path: b.path, name: b.name, bounds: b.bounds, walk: b.walk, hover: b.hover }));
  out.script = room.script;
  out.players = Object.values(room.players || {}).map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y }));
  // movie info
  const m = room.movie;
  out.movieKeys = m ? Object.keys(m).slice(0, 40) : null;
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 8000));
await b.close();
