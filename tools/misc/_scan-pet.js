const fs=require('fs'),path=require('path');
const f=path.join(__dirname,'..','client','public','assets','puffle','blue','timelines.json');
const tl=JSON.parse(fs.readFileSync(f,'utf8'));
const main=tl.main||{};
console.log('main frames:',(main.frames||[]).length,'labels:',JSON.stringify(main.labels||{}));
console.log('actions keys:',Object.keys(main.actions||{}).slice(0,20));
const fr=(main.frames||[])[0]||[];
for(const e of fr.slice(0,12))console.log(' ',e.name||('#d'+e.depth),'id='+e.id,'mx='+(e.matrix?e.matrix.slice(4).join(','):''));
