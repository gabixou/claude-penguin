import {decodePNG} from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-atlas.png'));
console.log('size',img.w,img.h,'ch',img.ch);
// alpha histogram
const hist={}; let opaque=0,semi=0,trans=0;
for(let i=3;i<img.data.length;i+=img.ch){const a=img.data[i];hist[a]=(hist[a]||0)+1;if(a===255)opaque++;else if(a===0)trans++;else semi++;}
console.log('opaque',opaque,'semi',semi,'trans',trans);
const top=Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,8);console.log(top);
// frame 0 rect from json
const frames=JSON.parse(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-frames.json'));
const f=frames.frames[0];console.log('frame0',JSON.stringify(f));
const {x,y,w,h}=f.frame;let cnt=0,sa=0;
for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const a=img.data[(yy*img.w+xx)*img.ch+3];if(a>0){cnt++;sa+=a;}}
console.log('frame0 nonzero-alpha px',cnt,'avg alpha',(sa/cnt).toFixed(1));
