globalThis.ImageData = class { constructor(w,h){ this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); } };
const { parseGpa2 } = await import('file:///E:/project/club-penguin-browser/client/src/items/gpa2.js');
import fs from 'node:fs';
const dir='E:/project/club-penguin-browser/client/public/assets/outfits/';
for(const f of ['428.gpa','403.gpa','342.gpa','171.gpa','avatar-1.gpa']){
  const b=fs.readFileSync(dir+f); const s=parseGpa2(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const rots={}; for(const q of s.sequences){const k=q.rotation+'/'+q.variation;rots[k]=(rots[k]||0)+1;}
  console.log(f,'fps='+s.fps,'scale='+s.scale,'actions='+s.actions,'seqs='+s.sequences.length,'rotations:',JSON.stringify(rots).slice(0,400));
}
