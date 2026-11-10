import fs from 'node:fs'; import zlib from 'node:zlib';
let buf=fs.readFileSync('tools/sndtmp/town-v.swf');
if(buf.toString('latin1',0,3)==='CWS') buf=Buffer.concat([buf.subarray(0,8),zlib.inflateSync(buf.subarray(8))]);
const nbits=buf[8]>>3, rb=Math.ceil((5+nbits*4)/8);
let off=8+rb+4;
while(off<buf.length-2){
  const h=buf.readUInt16LE(off); off+=2; const type=h>>6; let L=h&0x3f;
  if(L===0x3f){L=buf.readUInt32LE(off);off+=4;}
  if(type===0)break;
  if(type===76){ // SymbolClass
    const n=buf.readUInt16LE(off); let p=off+2; const out=[];
    for(let i=0;i<n;i++){const id=buf.readUInt16LE(p);p+=2;let s='';while(buf[p])s+=String.fromCharCode(buf[p++]);p++;out.push(id+':'+s);}
    console.log('SymbolClass:',out.join(', '));
  }
  if(type===14){console.log('DefineSound id',buf.readUInt16LE(off),'bytes',L);}
  off+=L;
}
