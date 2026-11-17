// Analisa offsets dos frames de cada .gpa para estimar o slot (head/face/neck/body/hand/feet)
globalThis.ImageData = class { constructor(w,h){ this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); } };
const { parseGpa2 } = await import('file:///E:/project/club-penguin-browser/client/src/items/gpa2.js');
import fs from 'node:fs';
const dir = 'E:/project/club-penguin-browser/client/public/assets/outfits/';
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.gpa')).sort()) {
  try {
    const s = parseGpa2((()=>{const b=fs.readFileSync(dir+f);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)})());
    const tops = s.frames.map(fr=>fr.top).sort((a,b)=>a-b);
    const med = tops[Math.floor(tops.length/2)];
    const min = tops[0], max = tops[tops.length-1];
    console.log(f.padEnd(16), 'frames='+String(s.count).padStart(5), 'top med='+String(med).padStart(5), 'min='+min, 'max='+max);
  } catch(e){ console.log(f, 'ERR', e.message); }
}
