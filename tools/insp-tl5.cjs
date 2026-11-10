const j=require('./town-timelines.json');
for(const [id,sp] of Object.entries(j.sprites)){
  if(sp.actions|| (sp.scriptFrames&&sp.scriptFrames.length)){
    console.log('sprite',id,'frames',sp.frames.length,'labels',JSON.stringify(sp.labels),'scriptFrames',JSON.stringify(sp.scriptFrames));
    console.log(' actions:',JSON.stringify(sp.actions).slice(0,500));
  }
}
console.log('main.actions keys:',Object.keys(j.main.actions||{}));
const a=j.main.actions&&j.main.actions['1'];
console.log('main action1 type:',typeof a, JSON.stringify(a).slice(0,300));
