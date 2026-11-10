const fs=require('fs');
const j=JSON.parse(fs.readFileSync('../client/public/assets/movies/mine/timelines.json','utf8'));
console.log('keys:',Object.keys(j));
console.log('pack:',JSON.stringify(j.pack??null).slice(0,300));
console.log('chunks:',JSON.stringify(j.chunks??null).slice(0,300));
console.log('fonts:',JSON.stringify(j.fonts??null).slice(0,400));
console.log('chars:',Object.keys(j.characters||{}).length,'sprites:',Object.keys(j.sprites||{}).length);
const kinds={};for(const c of Object.values(j.characters||{}))kinds[c.kind]=(kinds[c.kind]||0)+1;console.log(kinds);
