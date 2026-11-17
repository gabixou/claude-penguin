import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.penguinRoom?.movie && window.penguinRoom?.buttons?.length, null, { timeout: 60000 });
await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
    const room = window.penguinRoom;
    const fns = (o, name) => o ? Object.getOwnPropertyNames(o).filter(k => typeof o[k] === 'function').map(k => name + '.' + k) : [];
    return {
        roomFns: fns(room, 'room'),
        movieFns: room.movie ? fns(room.movie, 'movie').slice(0, 80) : null,
        players: Object.keys(room.players || {}),
    };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
