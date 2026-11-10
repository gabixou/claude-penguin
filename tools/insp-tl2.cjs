const j=require('./town-timelines.json');
const kinds={};
for(const [id,c] of Object.entries(j.characters)) kinds[c.kind]=(kinds[c.kind]||0)+1;
console.log('char kinds:',kinds);
console.log('sprites:',Object.keys(j.sprites).length,'main frames:',j.main.frames.length);
// frame entry fields
const f=j.main.frames[0];
console.log('frame0 entries:',f.length, JSON.stringify(f.slice(0,3)));
// all entry keys across frames
const keys=new Set();
for(const fr of j.main.frames) for(const e of fr) Object.keys(e).forEach(k=>keys.add(k));
console.log('entry keys:',[...keys]);
// sprite timeline sample
const sid=Object.keys(j.sprites)[0];
const sp=j.sprites[sid];
console.log('sprite',sid,'frames:',sp.frames.length,'keys:',Object.keys(sp));
const sk=new Set();
for(const fr of sp.frames) for(const e of fr) Object.keys(e).forEach(k=>sk.add(k));
console.log('sprite entry keys:',[...sk]);
// actions?
console.log('main actions:',JSON.stringify(j.main.actions||{}).slice(0,300));
console.log('buttonActions:',JSON.stringify(j.buttonActions||{}).slice(0,200));
console.log('editTexts:',JSON.stringify(j.editTexts||{}).slice(0,200));
console.log('scalingGrids:',JSON.stringify(j.scalingGrids||{}).slice(0,200));
