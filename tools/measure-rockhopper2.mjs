import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/ref-town-rockhopper.png'));
const W=img.w,H=img.h,d=img.data,ch=img.ch;
const px=(x,y)=>{const i=(y*W+x)*ch;return [d[i],d[i+1],d[i+2]];};
// regiao esquerda do puffle (300-390) e do puffle (385-430), y 380-500
// pinguim: pixels escuros (outline) ou saturados; neve e clara/azulada
function isSprite(c){const[r,g,b]=c;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx<110||(mx-mn>60&&mx<230);}
for(const [x0,x1,label] of [[300,385,'penguin?'],[385,430,'puffle?']]){
  let y0=1e9,y1=-1e9,cnt=0;
  for(let y=380;y<500;y++)for(let x=x0;x<x1;x++)if(isSprite(px(x,y))){cnt++;if(y<y0)y0=y;if(y>y1)y1=y;}
  console.log(label,'y',y0,y1,'h',y1-y0,'cnt',cnt);
}
// tambem: linhas com muitos pixels de sprite na faixa inteira 300-430
for(let y=380;y<500;y+=4){let c=0;for(let x=300;x<430;x++)if(isSprite(px(x,y)))c++;if(c>3)console.log('row',y,'cnt',c);}
