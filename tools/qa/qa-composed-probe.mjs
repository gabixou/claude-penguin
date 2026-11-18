// Probe: enumera sprites animados por frame principal de um movie clothing.
// Roda no página localhost:3000 com os módulos reais do client.
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ITEM = process.argv[2] || '407';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const res = await page.evaluate(async (item) => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  const mv = await MovieRoom.load(`/assets/clothing/${item}`);
  const clip = new Clip(mv);
  const main = mv.data.main;
  const nFrames = main.frames?.length || 1;
  const out = { item, nFrames, frames: [] };
  // pseudo-tick: para cada frame principal, descobre playheads animados
  // avancando os playheads artificialmente via draw em canvas minusculo
  const cv = document.createElement('canvas'); cv.width = cv.height = 4;
  const ctx = cv.getContext('2d');
  for (let f = 1; f <= nFrames; f++) {
    clip.goto('', f, false);
    clip.resetPlayback();
    // draw uma vez p/ criar playheads, depois avanca 3 ticks e ve quem muda
    await clip.draw(ctx, f, 0.05);
    const before = new Map();
    for (const [p, ph] of clip.playheads) before.set(p, ph.frame);
    for (let t = 0; t < 3; t++) { clip.advance(); await clip.draw(ctx, f, 0.05); }
    const anim = [];
    for (const [p, ph] of clip.playheads) {
      const tlLen = ph.timeline?.frames?.length || 1;
      const changed = before.get(p) !== ph.frame || tlLen > 1;
      // so conta se o frame realmente varia no loop (playhead girando)
      if (tlLen > 1 && ph.playing) anim.push({ path: p, len: tlLen, frame: ph.frame });
    }
    // tambem remove playheads de frames anteriores
    out.frames.push({ f, anim });
  }
  return out;
}, ITEM);
console.log(JSON.stringify(res, null, 1).slice(0, 8000));
await browser.close();
