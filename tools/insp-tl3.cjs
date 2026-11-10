const j=require('./town-timelines.json');
const s=JSON.stringify(j);
for(const w of ['mask','color','blend','tint','alpha','visible','frame"','"clip"','ratio']){
  const re=new RegExp('"'+w+'[a-zA-Z]*"','g'); const m=s.match(re);
  console.log(w, m? [...new Set(m)].slice(0,8):'none');
}
// sample a sprite with multiple frames
let multi=null;
for(const [id,sp] of Object.entries(j.sprites)) if(sp.frames.length>2){multi=[id,sp];break;}
console.log('multi sprite',multi?multi[0]:'none','frames:',multi?multi[1].frames.length:0);
if(multi) console.log(JSON.stringify(multi[1].frames.slice(0,3)).slice(0,1200));
// characters kinds detail
const btn=Object.entries(j.characters).filter(([k,c])=>c.kind==='button');
console.log('buttons:',JSON.stringify(btn).slice(0,600));
// shape char detail
const sh=Object.entries(j.characters).find(([k,c])=>c.kind==='shape');
console.log('shape sample:',JSON.stringify(sh));
// check svg fetch: chars.pack entries -> chunks; how does client fetch individual svg? test URL
