import fs from 'node:fs'; import zlib from 'node:zlib';
let buf=fs.readFileSync('tools/sndtmp/town-v.swf');
if(buf.toString('latin1',0,3)==='CWS') buf=Buffer.concat([buf.subarray(0,8),zlib.inflateSync(buf.subarray(8))]);
const nbits=buf[8]>>3, rb=Math.ceil((5+nbits*4)/8);
let off=8+rb+4; const strs=new Set();
while(off<buf.length-2){
  const h=buf.readUInt16LE(off); off+=2; const type=h>>6; let L=h&0x3f;
  if(L===0x3f){L=buf.readUInt32LE(off);off+=4;}
  if(type===0)break;
  if(type===12||type===59||type===0||type===1){
    const p=buf.subarray(off,off+L);
    for(const m of p.toString('latin1').matchAll(/[ -~]{4,}/g)) strs.add(m[0]);
  }
  off+=L;
}
const arr=[...strs].filter(s=>/sound|sfx|door|creak|click|whoosh|ding|chime|squeak|knock|splash|wind|bird|ambien|room/i.test(s));
console.log(arr.join('\n'));
