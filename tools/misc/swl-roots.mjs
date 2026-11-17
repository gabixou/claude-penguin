import { readFileSync } from 'node:fs';
import { loadSwl, SwlScene, ROOT, DRAW } from '../client/src/swl/swl.js';
const buf = readFileSync('../client/public/assets/scenes/town.swl');
const s = loadSwl(new Uint8Array(buf));
const scene = new SwlScene(s);
scene.prepare ? scene.prepare() : null;
// inspect draw entries
const draws = s.draw;
console.log('draws:', draws.length);
for (let i=0;i<draws.length;i++){
  const d=draws[i];
  if(d.type===ROOT) console.log('ROOT@'+i,'depth',d.depth,'matrix',JSON.stringify(d.matrix));
}
// print first few DRAW entries after each root
let shown=0;
for(let i=0;i<draws.length && shown<20;i++){
  const d=draws[i];
  if(d.type===DRAW){console.log('DRAW@'+i,'depth',d.depth,'m',JSON.stringify(d.matrix),'art',d.art);shown++;}
}
