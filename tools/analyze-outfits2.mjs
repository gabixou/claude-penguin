globalThis.ImageData = class { constructor(w,h){ this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); } };
const { parseGpa2 } = await import('file:///E:/project/club-penguin-browser/client/src/items/gpa2.js');
import fs from 'node:fs';
const dir = 'E:/project/club-penguin-browser/client/public/assets/outfits/';
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.gpa')&&f!=='avatar-1.gpa').sort()) {
  const b=fs.readFileSync(dir+f); const s = parseGpa2(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  // usa o 1o frame de cada sequence variation 1 rotation 1-8 (idle) p/ medir posicao
  const ys=[];
  for(const q of s.sequences){ if(q.variation!==1) continue; const fr=s.frames[q.start]; if(fr) ys.push({top:fr.top,h:fr.h,left:fr.left,w:fr.w}); }
  if(!ys.length){const fr=s.frames[0];ys.push({top:fr.top,h:fr.h,left:fr.left,w:fr.w});}
  const avg=ys.reduce((a,c)=>({top:a.top+c.top,h:a.h+c.h,left:a.left+c.left,w:a.w+c.w}),{top:0,h:0,left:0,w:0});
  const n=ys.length;
  const cy=avg.top+avg.h/2/n*0 + (avg.top/n)+(avg.h/n)/2;
  console.log(f.padEnd(12),'cy=',cy.toFixed(0).padStart(5),'top=',(avg.top/n).toFixed(0).padStart(5),'h=',(avg.h/n).toFixed(0).padStart(4),'left=',(avg.left/n).toFixed(0).padStart(5),'w=',(avg.w/n).toFixed(0));
}
