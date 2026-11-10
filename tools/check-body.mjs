import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-body.png'));
console.log('size',img.w,img.h);
let white=0, opaque=0;
for(let i=0;i<img.data.length;i+=4){if(img.data[i+3]>0){opaque++;if(img.data[i]===255&&img.data[i+1]===255&&img.data[i+2]===255)white++;}}
console.log('opaque',opaque,'white',white);
// frame0 rect
const frames=JSON.parse(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-frames.json'));
const f=frames.frames[0];const{x,y,w,h}=f.frame;let c=0;
for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*img.w+xx)*4;if(img.data[i+3]>128)c++;}
console.log('frame0 solid px',c);
