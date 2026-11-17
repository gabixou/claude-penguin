import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/rooms/town.png'));
// procura verde puro/brilhante (provavel debug overlay)
let minx=1e9,miny=1e9,maxx=-1,maxy=-1,cnt=0; const colors={};
for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){
  const i=(y*img.w+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
  if(g>200&&r<80&&b<80){cnt++;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
    const k=r+','+g+','+b;colors[k]=(colors[k]||0)+1;}
}
console.log('pureGreen px',cnt,'bbox',minx,miny,maxx,maxy);
console.log(Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,10));
