import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const URL = process.argv[2] || 'http://localhost:3000/';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  await movie.ensureFonts?.();
  const matMul = (p, q) => ({ a: p.a*q.a+p.c*q.b, b: p.b*q.a+p.d*q.b, c: p.a*q.c+p.c*q.d, d: p.b*q.c+p.d*q.d, x: p.a*q.x+p.c*q.y+p.x, y: p.b*q.x+p.d*q.y+p.y });
  const IDENT = { mult: [1,1,1,1], add: [0,0,0,0] };
  const oldNine = async (ctx, frame, world, path, color, scale, depth, grid, local) => {
    const p = movie._boundsOfEntries(frame, { a:1,b:0,c:0,d:1,x:0,y:0 }, path);
    if (!p) { await movie._drawEntries(ctx, frame, world, path, color, scale, depth+1); return; }
    const b = [p[0], grid[0], grid[2], p[2]], v = [p[1], grid[1], grid[3], p[3]];
    const w = Math.min(1, ((p[2]-p[0])*local.a)/((grid[0]-p[0])+(p[2]-grid[2])));
    const S = Math.min(1, ((p[3]-p[1])*local.d)/((grid[1]-p[1])+(p[3]-grid[3])));
    const x = [p[0], p[0]+(grid[0]-p[0])*w/local.a, p[2]-(p[2]-grid[2])*w/local.a, p[2]];
    const C = [p[1], p[1]+(grid[1]-p[1])*S/local.d, p[3]-(p[3]-grid[3])*S/local.d, p[3]];
    const devRect = (rx,ry,rw,rh) => { const pts=[[rx,ry],[rx+rw,ry],[rx,ry+rh],[rx+rw,ry+rh]].map(([px,py])=>[world.a*px+world.c*py+world.x, world.b*px+world.d*py+world.y]); const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]); return [Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)]; };
    for (let rr=0;rr<3;rr++) for (let cc=0;cc<3;cc++) {
      const P=x[cc+1]-x[cc], I=C[rr+1]-C[rr];
      if (P<=0||I<=0||b[cc+1]===b[cc]||v[rr+1]===v[rr]) continue;
      const kx=P/(b[cc+1]-b[cc]), ky=I/(v[rr+1]-v[rr]);
      const t={a:kx,b:0,c:0,d:ky,x:x[cc]-b[cc]*kx,y:C[rr]-v[rr]*ky};
      const mSlice=matMul(world,t);
      const [dx,dy,dw,dh]=devRect(x[cc],C[rr],P,I);
      if (dw<=0||dh<=0) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(dx,dy,dw,dh); ctx.clip();
      await movie._drawEntries(ctx, frame, mSlice, path, color, scale, depth+1);
      ctx.restore();
    }
  };
  const sid='5', grid=movie.scalingGrids[sid], frame=movie.sprites[sid].frames[0];
  const world={a:2,b:0,c:0,d:2,x:100,y:100}, local={a:1,b:0,c:0,d:1,x:0,y:0};
  const mk=()=>{const c=document.createElement('canvas');c.width=700;c.height=700;return c;};
  const cO=mk(),cN=mk(),xO=cO.getContext('2d'),xN=cN.getContext('2d');
  await oldNine(xO,frame,world,'dbg',IDENT,2,1,grid,local);
  await movie._drawNineSlice(xN,frame,world,'dbg',IDENT,2,1,grid,local);
  const d1=xO.getImageData(0,0,700,700).data,d2=xN.getImageData(0,0,700,700).data;
  let diff=0,bbox=[1e9,1e9,-1,-1];
  for(let i=0;i<d1.length;i+=4){const dd=Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])+Math.abs(d1[i+3]-d2[i+3]);
    if(dd>24){diff++;const px=(i/4)%700,py=Math.floor(i/4/700);if(px<bbox[0])bbox[0]=px;if(px>bbox[2])bbox[2]=px;if(py<bbox[1])bbox[1]=py;if(py>bbox[3])bbox[3]=py;}}
  return {diffPx:diff,bbox:bbox[0]>bbox[2]?null:bbox,old:cO.toDataURL('image/png'),nw:cN.toDataURL('image/png')};
});
console.log(JSON.stringify({diffPx:r.diffPx,bbox:r.bbox}));
if(r.old){writeFileSync('shots/ab1-old.png',Buffer.from(r.old.split(',')[1],'base64'));writeFileSync('shots/ab1-new.png',Buffer.from(r.nw.split(',')[1],'base64'));}
await b.close();
