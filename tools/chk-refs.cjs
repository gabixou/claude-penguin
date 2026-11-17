const j=require('../client/public/assets/movies/town/timelines.json');
const targets=['36','44','56','71','92'];
function scan(tlId, path){
  const tl = tlId==='main'? {frames:j.main.frames,labels:{}} : j.sprites[tlId];
  if(!tl) return;
  for(const [fi,frame] of (tl.frames||[]).entries()){
    for(const e of frame){
      if(targets.includes(String(e.id))) console.log('ref',e.id,'in tl',tlId,'frame',fi+1,'name',e.name,'path~',path);
      if(j.sprites[String(e.id)]) scan(String(e.id), path?path+'.'+(e.name||'#'+e.depth):(e.name||'#'+e.depth));
    }
  }
}
scan('main','');
// tambem: labels dos sprites 36 etc ja confirmados; verificar se estao em frames de background_mc(103)
const bg=j.sprites['103'];
console.log('bg frames:',bg.frames.length);
for(const [fi,f] of bg.frames.entries()){
  const ids=f.map(e=>e.id); 
  if(ids.some(i=>targets.includes(String(i)))) console.log('bg frame',fi+1,'has target, entries:',f.length);
}
