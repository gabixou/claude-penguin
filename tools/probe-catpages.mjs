import { chromium } from 'playwright-core';
import fs from 'fs';
const cat = process.argv[2] || 'clothing';
const frames = (process.argv[3] || '0,5,10,15,20').split(',').map(Number);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(async ({ cat, frames }) => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const m = await MovieRoom.load('/assets/catalogues/' + cat);
  const out = [];
  for (const f of frames) {
    const c = document.createElement('canvas'); c.width = 760 * 2; c.height = 480 * 2;
    await m.renderFrame(f, c, 2);
    out.push({ f, url: c.toDataURL('image/png') });
  }
  return out;
}, { cat, frames });
for (const { f, url } of r) {
  fs.writeFileSync(`shots/cat-${cat}-f${f}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('saved', r.map(x => x.f).join(','));
await b.close();
