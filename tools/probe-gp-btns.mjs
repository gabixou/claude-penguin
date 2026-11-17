import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const room = window.penguinRoom;
  return {
    buttons: JSON.parse(JSON.stringify(room.buttons || [], (k, v) => typeof v === 'function' ? 'fn' : v)).slice(0, 4000),
    roomKeys: Object.keys(room),
    movieStateKeys: room.movie?.state ? Object.keys(room.movie.state).slice(0, 10) : null,
  };
});
console.log(JSON.stringify(r, null, 1).slice(0, 6000));
await b.close();
