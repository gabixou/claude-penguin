const fs=require('fs');
const ids=fs.readdirSync('client/public/assets/paper').filter(d=>/^\d+$/.test(d));
fs.writeFileSync('client/public/assets/paper/index.json', JSON.stringify(ids.map(Number).sort((a,b)=>a-b)));
console.log(ids.length,'ids');
const cat=JSON.parse(fs.readFileSync('client/public/assets/items.json','utf8'));
const byId=new Map(cat.map(i=>[i.id,i]));
for(const id of ids.map(Number)){const it=byId.get(id);console.log(id, it?((it.name||'?')+' t'+it.type):'NO-CATALOG');}
