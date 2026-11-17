import fs from 'node:fs'; import zlib from 'node:zlib';
let buf=fs.readFileSync('tools/sndtmp/town-v.swf');
if(buf.toString('latin1',0,3)==='CWS') buf=Buffer.concat([buf.subarray(0,8),zlib.inflateSync(buf.subarray(8))]);
const nbits=buf[8]>>3, rb=Math.ceil((5+nbits*4)/8);
let off=8+rb+4; const acts=[];
while(off<buf.length-2){
  const h=buf.readUInt16LE(off); off+=2; const type=h>>6; let L=h&0x3f;
  if(L===0x3f){L=buf.readUInt32LE(off);off+=4;}
  if(type===0)break;
  if(type===12||type===59){ // DoAction / DoInitAction
    const p=buf.subarray(off,off+L);
    const str=p.toString('latin1');
    const hits=[];
    for(const m of str.matchAll(/[ -~]{6,}/g)){
      const s=m[0];
      if(/sound|Sound|play|door|btn/i.test(s)) hits.push(s.slice(0,120));
    }
    if(hits.length) acts.push({type, hits: hits.slice(0,15)});
  }
  off+=L;
}
console.log(JSON.stringify(acts,null,1).slice(0,6000));
