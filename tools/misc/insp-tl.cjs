const j=require('./town-timelines.json');
console.log(Object.keys(j));
console.log('pack:',j.pack);
console.log('chunks:',JSON.stringify(j.chunks).slice(0,400));
console.log('fonts:',JSON.stringify(j.fonts).slice(0,300));
const chars=j.characters||j.art||{};
console.log('characters:',Object.keys(chars).length);
const k=Object.keys(chars)[0];
console.log('sample char',k,JSON.stringify(chars[k]).slice(0,400));
