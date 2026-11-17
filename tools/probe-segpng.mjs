import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const urls = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const out = {};
  (sc.movieLayers || []).forEach((s, i) => {
    if (s.canvas) out['seg' + i + '_d' + s.depth.toFixed(4)] = s.canvas.toDataURL('image/png');
  });
  (sc._dynList || []).forEach((d, i) => {
    if (d.canvas) out['dyn' + i + '_' + d.path.split('.').pop()] = d.canvas.toDataURL('image/png');
  });
  return out;
});
for (const [k, u] of Object.entries(urls)) {
  if (u.startsWith('data:')) fs.writeFileSync('shots/x-' + k.replace(/[^\w#-]/g, '_') + '.png', Buffer.from(u.split(',')[1], 'base64'));
}
console.log(Object.keys(urls).join('\n'));
await b.close();
