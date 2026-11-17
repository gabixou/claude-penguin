import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/ref-walkpuffle.png'));
const W=img.w,H=img.h,d=img.data,ch=img.ch;
const px=(x,y)=>{const i=(y*W+x)*ch;return [d[i],d[i+1],d[i+2]];};
// ASCII art 2px por celula, quadrante inferior direito + um pouco mais
for(let y=140;y<H;y+=3){let row='';for(let x=140;x<W;x+=2){const[r,g,b]=px(x,y);const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  // classifica: '#' escuro, 'C' cyan/azul claro, 'R' vermelho, 'W' branco, '.' fundo
  let c='.';
  if(mx<90)c='#';
  else if(mx-mn>70&&b>r+30)c='B';
  else if(r>g+40&&r>b+40)c='R';
  else if(b>r+30&&b>g+10)c='b';
  else if(mx>220&&mx-mn<40)c='W';
  else if(mx-mn>60)c='c';
  row+=c;}
  console.log(String(y).padStart(3),row);}
