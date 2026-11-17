const j=require('./town-timelines.json');
const f=j.main.frames[0];
for(const e of f) console.log(JSON.stringify({depth:e.depth,id:e.id,name:e.name,m:e.matrix}));
