import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
for (const f of ['loader_arrows.gif', 'loader_arrows_sm.gif']) {
  const out = await p.evaluate(async (f) => {
    const img = new Image();
    img.src = '/assets/ui/' + f;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth * 4; c.height = img.naturalHeight * 4;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, f).catch(e => 'ERR ' + e.message);
  require('fs').writeFileSync('tools/shots/' + f.replace('.gif', '.png'), Buffer.from(out.split(',')[1] || '', 'base64'));
}
await b.goto('http://localhost:3000');
await b.close();
