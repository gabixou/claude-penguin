import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/ref-town-rockhopper.png'));
const ch = img.data.length === img.w*img.h*3 ? 3 : 4;
const W=img.w,H=img.h,d=img.data;
const px=(x,y)=>{const i=(y*W+x)*ch;return [d[i],d[i+1],d[i+2]];};
// reddish pixels (puffle rojo): R alto, G/B bajos
const red=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const[r,g,b]=px(x,y);if(r>170&&g<110&&b<110)red.push([x,y]);}
console.log('red px',red.length);
// cluster simples por proximidade
const clusters=[];
for(const p of red){let best=null,bd=1e9;for(const c of clusters){const dx=p[0]-c.cx,dy=p[1]-c.cy,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=c;}}if(best&&bd<900){best.n++;best.sx+=p[0];best.sy+=p[1];best.x0=Math.min(best.x0,p[0]);best.x1=Math.max(best.x1,p[0]);best.y0=Math.min(best.y0,p[1]);best.y1=Math.max(best.y1,p[1]);best.cx=best.sx/best.n;best.cy=best.sy/best.n;}else clusters.push({n:1,sx:p[0],sy:p[1],cx:p[0],cy:p[1],x0:p[0],x1:p[0],y0:p[1],y1:p[1]});}
clusters.sort((a,b)=>b.n-a.n);
for(const c of clusters.slice(0,8))console.log({n:c.n,bbox:[c.x0,c.y0,c.x1,c.y1],w:c.x1-c.x0+1,h:c.y1-c.y0+1,cx:Math.round(c.cx),cy:Math.round(c.cy)});
