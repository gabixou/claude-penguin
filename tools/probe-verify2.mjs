import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
console.log('room ready');
await p.waitForTimeout(4000);
const inp = await p.evaluate(() => {
  const el = document.querySelector('input');
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
console.log('chatInput:', JSON.stringify(inp));
// card
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
for (let i = 0; i < 90; i++) {
  const open = await p.evaluate(() => !!window.__penguin.scene.playerCard?.container).catch(() => false);
  if (open) { console.log('card open after', i, 's'); break; }
  await p.waitForTimeout(1000);
}
const doll = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  const img = scene.playerCard.container.list.find(o => o.type === 'Image');
  const src = scene.textures.get(img.texture.key).getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let dark = 0, colored = 0, total = 0;
  for (let yy = Math.floor(c.height * 0.35); yy < c.height * 0.75; yy++)
    for (let xx = Math.floor(c.width * 0.3); xx < c.width * 0.7; xx++) {
      const i = (yy * c.width + xx) * 4;
      if (d[i+3] < 30) continue; total++;
      const lum = 0.3*d[i]+0.6*d[i+1]+0.1*d[i+2];
      if (lum < 80) dark++;
      else if (Math.abs(d[i]-d[i+1])>20 || Math.abs(d[i+1]-d[i+2])>20) colored++;
    }
  return { w: c.width, h: c.height, dark, colored, total };
});
console.log('card doll early:', JSON.stringify(doll));
await p.waitForTimeout(25000);
const doll2 = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  const img = scene.playerCard.container.list.find(o => o.type === 'Image');
  const src = scene.textures.get(img.texture.key).getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let dark = 0, colored = 0, total = 0;
  for (let yy = Math.floor(c.height * 0.35); yy < c.height * 0.75; yy++)
    for (let xx = Math.floor(c.width * 0.3); xx < c.width * 0.7; xx++) {
      const i = (yy * c.width + xx) * 4;
      if (d[i+3] < 30) continue; total++;
      const lum = 0.3*d[i]+0.6*d[i+1]+0.1*d[i+2];
      if (lum < 80) dark++;
      else if (Math.abs(d[i]-d[i+1])>20 || Math.abs(d[i+1]-d[i+2])>20) colored++;
    }
  return { dark, colored, total };
});
console.log('card doll late:', JSON.stringify(doll2));
await p.screenshot({ path: 'shots/pc-verify2.png', timeout: 120000 });
// bubble
await p.evaluate(() => window.__penguin.scene.playerCard.close());
await p.evaluate(() => window.__penguin.scene.localPlayer.showChat('ola mundo'));
await p.waitForTimeout(2500);
const bub = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  const img = scene.localPlayer.chatBubble.list.find(o => o.type === 'Image');
  const src = scene.textures.get(img.texture.key).getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1;
  for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
    const i = (yy * c.width + xx) * 4;
    if (d[i+3] > 100 && d[i] < 100 && d[i+1] < 100 && d[i+2] < 100) {
      if (yy<minY)minY=yy; if(yy>maxY)maxY=yy; if(xx<minX)minX=xx; if(xx>maxX)maxX=xx;
    }
  }
  return { w: c.width, h: c.height, textTop: minY, textBottom: maxY, textLeft: minX, textRight: maxX };
});
console.log('bubble tex:', JSON.stringify(bub));
await p.screenshot({ path: 'shots/bub-verify2.png', timeout: 120000 });
await b.close();
