import { decodePNG } from './png.mjs';
import fs from 'node:fs';
for (const f of fs.readdirSync('E:/project/club-penguin-browser/client/public/assets/rooms')) {
  const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/rooms/'+f));
  let green=0, greenA=0;
  for(let i=0;i<img.data.length;i+=img.ch){
    const r=img.data[i],g=img.data[i+1],b=img.data[i+2],a=img.data[i+3];
    if(a>0 && g>150 && r<100 && b<100){green++; if(a<250)greenA++;}
  }
  console.log(f.padEnd(14), img.w+'x'+img.h, 'greenPx='+green, 'semiGreen='+greenA);
}
