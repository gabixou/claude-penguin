import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

// metrica de nitidez do canvas interno do pinguim (alpha-weighted)
const metric = `(() => {
  const pg = window.__penguin;
  const cx = pg._canvas.getContext('2d');
  const d = cx.getImageData(0,0,pg._canvas.width,pg._canvas.height).data;
  const W = pg._canvas.width, H = pg._canvas.height;
  let g=0,n=0;
  const lum=(x,y)=>{const i=(y*W+x)*4;return d[i]*d[i+3]/255 + d[i+1]*d[i+3]/255 + d[i+2]*d[i+3]/255;};
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    if(d[(y*W+x)*4+3]<40) continue;
    g+=Math.abs(lum(x,y)-lum(x-1,y))+Math.abs(lum(x,y)-lum(x,y-1)); n++;
  }
  return {energy:+(g/Math.max(1,n)).toFixed(2), px:n, size:[W,H]};
})()`;

const seq = [];
for (const act of ['idle','dance','idle','throw','idle','walk']) {
  await p.evaluate(a => { const pg=window.__penguin; if(a==='walk'){pg.setAction('walk');} else pg.setAction(a); }, act);
  await p.waitForTimeout(act==='walk'?300:600);
  seq.push({ act, ...(await p.evaluate(metric)) });
}
console.log(JSON.stringify(seq));
await b.close();
