import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON:', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);

await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(6000); // MovieRoom.load + pack decode

const st = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  return {
    native: !!g,
    canvas: !!document.querySelector('iframe') === false && !!g?.canvas,
    movieReady: !!g?.movie,
    mainFrame: g?.movie?._mainFrame,
  };
});
console.log('estado:', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/icefish-native-menu.png' });

// clica PLAY
await p.evaluate(() => {
  const btns = [...document.querySelectorAll('div')].filter(d => d.textContent === 'PLAY');
  btns[0]?.click();
});
await p.waitForTimeout(4000);
const st2 = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  if (!g?.movie) return { err: 'no movie' };
  return {
    mainFrame: g.movie._mainFrame,
    running: g.model.running,
    hookFrame: g._frame('hook'),
    fish1Frame: g._frame('fish1'),
    poses: ['hook','fish1','line','penguin'].map(n => {
      const pose = g.movie.pose(n);
      return pose ? `${n}:f${pose.frame},id${pose.id},b[${pose.bounds?.map(v=>Math.round(v)).join(',')}]` : `${n}:null`;
    }),
  };
});
console.log('gameplay:', JSON.stringify(st2, null, 1));
await p.screenshot({ path: 'tools/shots/icefish-native-game.png' });
await b.close();
