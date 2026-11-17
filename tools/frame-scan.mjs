import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-atlas.png'));
const frames=JSON.parse(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-frames.json'));
// scan frames 0-7 (idle) - alpha por linha e por regiao
for(const fi of [0,1,4]){
  const f=frames.frames[fi];const{x,y,w,h}=f.frame;
  console.log('frame',fi,'rect',x,y,w,h,'offset',JSON.stringify(f.offset));
  for(let yy=0;yy<h;yy++){
    let cnt=0;for(let xx=0;xx<w;xx++){if(img.data[((y+yy)*img.w+x+xx)*4+3]>30)cnt++;}
    if(cnt) console.log('  row',yy,'alphaPx',cnt);
  }
}
