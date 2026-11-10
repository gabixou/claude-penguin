const j=require('E:/project/club-penguin-browser/client/public/assets/movies/town/timelines.json');
console.log('main labels:',JSON.stringify(j.main.labels));
console.log('main frames:',j.main.frames.length);
let langs=new Set();
for(const [id,sp] of Object.entries(j.sprites)) for(const l of Object.keys(sp.labels||{})) langs.add(l);
console.log('sprite labels:',[...langs].slice(0,60));
