import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/clone-canvas-full.png'));
const ch = img.data.length === img.w*img.h*3 ? 3 : 4;
// arena: local (380,312)->canvas~(1330,1001); arenovisk (371,359)->(1309,1125); puffle (391,367)->(1354,1125)
// crop generoso cobrindo os dois pinguins+puffle: canvas x 1150-1520, y 850-1250
const x0=1150,y0=850,w=370,h=400,S=2,W=w*S,H=h*S;
const out=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(img.w-1,x0+(x/S|0)),sy=Math.min(img.h-1,y0+(y/S|0));const si=(sy*img.w+sx)*ch,di=(y*W+x)*4;out[di]=img.data[si];out[di+1]=img.data[si+1];out[di+2]=img.data[si+2];out[di+3]=ch===4?img.data[si+3]:255;}
fs.writeFileSync('tools/shots/crop-clone-puffle-qa.png',encodePNG(W,H,4,out));
console.log('ok',img.w,img.h);
