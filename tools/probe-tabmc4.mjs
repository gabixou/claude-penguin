import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const m = await MovieRoom.load('/assets/movies/interface');
  const clip = new Clip(m);
  const IDENT = {a:1,b:0,c:0,d:1,x:0,y:0};
  const e = m.sprites['585'].frames[0][0];
  const out = { entry: e };
  // resolve: sprite or character?
  out.isSprite = !!m.sprites[String(e.id)];
  out.char = m.characters?.[String(e.id)] ? { file: m.characters[String(e.id)].file, kind: m.characters[String(e.id)].kind } : null;
  // bounds of tab_mc content
  out.bounds = clip._boundsOf(m.sprites['585'].frames[0], IDENT, '');
  // sort_btn sprite 680? check characters/sprites
  for (const id of ['680','681','674','675','672','677','238','595','600','141','142']) {
    out['id'+id] = { sp: !!m.sprites[id], spFrames: m.sprites[id]?.frames?.length,
      ch: !!m.characters?.[id], kind: m.characters?.[id]?.kind };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 6000));
await b.close();
