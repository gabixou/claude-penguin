const j=require('../client/public/assets/movies/town/timelines.json');
for(const [id,sp] of Object.entries(j.sprites)){
  const l=sp.labels||{};
  if(l.english!==undefined){
    console.log('sprite',id,'frames',sp.frames.length,'labels',JSON.stringify(l),'actions',JSON.stringify(sp.actions||{}).slice(0,200),'scriptFrames',JSON.stringify(sp.scriptFrames||[]));
  }
}
const src=(j.main.actions['1']&&(j.main.actions['1'].source||j.main.actions['1'].custom))||'';
const lines=src.split('\n').filter(l=>/lang|gotoAndStop|stop\(|frame/i.test(l));
console.log('--- main script lang lines ---');
console.log(lines.slice(0,50).join('\n'));
