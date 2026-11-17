import { chromium } from 'playwright-core';
import fs from 'node:fs';
const ids = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(1500);
// carrega SVGs via fetch e desenha
const svgs = {};
for (const id of ids) {
  svgs[id] = await p.evaluate(async (id) => {
    const m = window.__penguin.scene.movie;
    const ch = m.characters[id];
    if (!ch?.file) return null;
    try { return m._svgText(ch.file); } catch (e) { return null; }
  }, id);
}
const url = await p.evaluate(async ({ svgs, ids }) => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 800;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20304a'; ctx.fillRect(0, 0, 1200, 800);
  ctx.font = '14px monospace'; ctx.fillStyle = '#fff';
  const cols = 4, cellW = 300, cellH = 160;
  let i = 0;
  for (const id of ids) {
    const svg = svgs[id];
    if (!svg) { ctx.fillText(id + ' MISSING', 10 + (i % cols) * cellW, 20 + Math.floor(i / cols) * cellH); i++; continue; }
    const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
    const cx = 10 + (i % cols) * cellW, cy = 10 + Math.floor(i / cols) * cellH;
    ctx.fillText('char ' + id, cx, cy + 12);
    const sc = Math.min(140 / img.width, 120 / img.height, 2);
    ctx.drawImage(img, cx, cy + 20, img.width * sc, img.height * sc);
    i++;
  }
  return c.toDataURL('image/png');
}, { svgs, ids });
fs.writeFileSync('shots/chars-sheet.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('done', ids.join(','));
await b.close();
