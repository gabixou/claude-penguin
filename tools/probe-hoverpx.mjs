import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.waitForTimeout(500);
const sample = `(() => {
  const sc = window.__penguin.scene;
  const btn = sc._interactions.buttons.find(x => /shop/.test(x.path));
  const [x0,y0,x1,y1] = btn.bounds;
  const layer = sc.movieLayers.find(l => l.rootKey === 'background_mc');
  const cv = layer.canvas, ctx = cv.getContext('2d');
  const ss = sc._ss;
  const d = ctx.getImageData(Math.floor(x0*ss), Math.floor(y0*ss), Math.ceil((x1-x0)*ss), Math.ceil((y1-y0)*ss)).data;
  let sum=0,n=0;
  for(let i=0;i<d.length;i+=40){ sum+=d[i]+d[i+1]+d[i+2]; n++; }
  return {avg: Math.round(sum/n), btn: btn.path};
})()`;
const before = await p.evaluate(sample);
const rect = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
const shop = await p.evaluate(() => { const bt = window.__penguin.scene._interactions.buttons.find(x=>/shop/.test(x.path)); const [x0,y0,x1,y1]=bt.bounds; return [(x0+x1)/2,(y0+y1)/2]; });
await p.mouse.move(rect.x + shop[0]/760*rect.w, rect.y + shop[1]/480*rect.h);
await p.waitForTimeout(900);
const after = await p.evaluate(sample);
const st = await p.evaluate(() => ({hovered: window.__penguin.scene._interactions.hovered, states:[...window.__penguin.scene.movie._buttonStates.entries()]}));
console.log(JSON.stringify({before, after, st}));
await p.screenshot({ path: 'tools/shots/clone-town-hover-shop.png' });
await b.close();
