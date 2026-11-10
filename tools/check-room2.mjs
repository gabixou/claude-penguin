import { decodePNG } from './png.mjs';
import fs from 'node:fs';
for (const f of ['town.png','coffee.png','dance.png','pizza.png']) {
  const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/rooms/'+f));
  const ahist={}; let semi=0;
  for(let i=3;i<img.data.length;i+=img.ch){const a=img.data[i];ahist[a]=(ahist[a]||0)+1;if(a>0&&a<255)semi++;}
  // greenish: g significantly > r and b
  let greenish=0;
  for(let i=0;i<img.data.length;i+=img.ch){const r=img.data[i],g=img.data[i+1],b=img.data[i+2];if(img.data[i+3]>200&&g>r+40&&g>b+40)greenish++;}
  console.log(f,'semiAlphaPx='+semi,'greenish='+greenish,'alphaTop='+Object.entries(ahist).sort((a,b)=>b[1]-a[1]).slice(0,4));
}
