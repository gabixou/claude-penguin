const j=require('./town-timelines.json');
const s=new Set(Object.keys(j.sprites)), c=new Set(Object.keys(j.characters));
const both=[...s].filter(x=>c.has(x));
console.log('id overlap sprites∩characters:',both);
// which ids do entries reference? sample resolution check
const refs=new Set();
const scan=fr=>{for(const e of fr){refs.add(String(e.id));}};
for(const f of j.main.frames)scan(f);
for(const sp of Object.values(j.sprites))for(const f of sp.frames)scan(f);
let onlySprite=0,onlyChar=0,both2=0,none=0;
for(const id of refs){const a=s.has(id),b=c.has(id);if(a&&b)both2++;else if(a)onlySprite++;else if(b)onlyChar++;else none++;}
console.log({onlySprite,onlyChar,both:both2,none,total:refs.size});
// do sprite frames reference sprite ids (nested)?
console.log('exports:',JSON.stringify(j.exports));
