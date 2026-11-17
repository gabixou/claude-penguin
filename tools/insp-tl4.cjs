const j=require('./town-timelines.json');
const packFiles=new Set(Object.keys(j.pack.entries));
const chunkFiles=new Set(Object.keys(j.chunks.entries));
let missing=[],inChunk=[];
for(const [id,c] of Object.entries(j.characters)){
  if(c.kind!=='shape')continue;
  if(packFiles.has(c.file))continue;
  if(chunkFiles.has(c.file))inChunk.push(c.file);else missing.push(c.file);
}
console.log('shape files:',Object.values(j.characters).filter(c=>c.kind==='shape').length);
console.log('in chars.pack:',Object.values(j.characters).filter(c=>c.kind==='shape'&&packFiles.has(c.file)).length);
console.log('in chunks only:',inChunk.length, inChunk.slice(0,10));
console.log('missing:',missing);
console.log('chunk entry sample:',JSON.stringify(Object.entries(j.chunks.entries).slice(0,3)));
// find 'color' and 'ratio' occurrences
const s=JSON.stringify(j);
for(const w of ['"color"','"ratio"','"visible"','"blendMode"','"mask"']){
  let i=s.indexOf(w); if(i>=0)console.log(w,'->',s.slice(Math.max(0,i-120),i+200));
}
// sprite actions / scriptFrames
let withActions=0,withScript=0,multi=0;
for(const sp of Object.values(j.sprites)){
  if(sp.actions)withActions++;
  if(sp.scriptFrames&&sp.scriptFrames.length)withScript++;
  if(sp.frames.length>1)multi++;
}
console.log('sprites:',Object.keys(j.sprites).length,'multi-frame:',multi,'withActions:',withActions,'withScriptFrames:',withScript);
console.log('main scriptFrames:',JSON.stringify(j.main.scriptFrames).slice(0,200));
