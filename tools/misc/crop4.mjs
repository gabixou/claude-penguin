import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/clone-town-puffle-fixed.png'));
const ch = img.data.length === img.w*img.h*3 ? 3 : 4;
// penguin world (380,312), camera scroll? getBounds gave world coords; screen = world - scroll... compute via canvas: scroll unknown; crop wide center-bottom area generously
// screen pos approx: canvas 961x607 shows world viewport; camera centers on player -> penguin ~center. Crop center region.
const x0=400,y0=300,w=240,h=180,S=4,W=w*S,H=h*S;
const out=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(img.w-1,x0+(x/S|0)),sy=Math.min(img.h-1,y0+(y/S|0));const si=(sy*img.w+sx)*ch,di=(y*W+x)*4;out[di]=img.data[si];out[di+1]=img.data[si+1];out[di+2]=img.data[si+2];out[di+3]=ch===4?img.data[si+3]:255;}
fs.writeFileSync('tools/shots/crop-clone-puffle-fixed.png',encodePNG(W,H,4,out));
console.log('ok',img.w,img.h);
