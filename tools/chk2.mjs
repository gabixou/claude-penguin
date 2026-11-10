import fs from 'node:fs';
import zlib from 'node:zlib';
function decodePNG(buf){let off=8;const idat=[];let w,h;while(off<buf.length){const len=buf.readUInt32BE(off);const type=buf.toString('ascii',off+4,off+8);const data=buf.subarray(off+8,off+8+len);if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);}if(type==='IDAT')idat.push(data);off+=12+len;}const raw=zlib.inflateSync(Buffer.concat(idat));const bpp=4,stride=w*bpp;const out=Buffer.alloc(w*h*bpp);let prev=Buffer.alloc(stride);for(let y=0;y<h;y++){const f=raw[y*(stride+1)];const line=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));for(let i=0;i<stride;i++){const a=i>=bpp?line[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=line[i];if(f===1)v=(v+a)&255;else if(f===2)v=(v+b)&255;else if(f===3)v=(v+((a+b)>>1))&255;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255;}line[i]=v;}line.copy(out,y*stride);prev=line;}return{w,h,data:out};}
const img=decodePNG(fs.readFileSync(process.argv[2]||'icons.png'));
for(const cx of [2,3,11,12]){
console.log('=== cell '+cx+' ===');
for(let y=0;y<32;y+=1){let row='';for(let x=0;x<32;x+=1){const i=((0*32+y)*img.w+cx*32+x)*4;const a=img.data[i+3];row+=a>200?'#':a>80?'+':a>10?'.':' ';}console.log(row);}
const cnt={};
for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=((y)*img.w+cx*32+x)*4;if(img.data[i+3]>100){const k=img.data[i]+','+img.data[i+1]+','+img.data[i+2];cnt[k]=(cnt[k]||0)+1;}}
console.log(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,6));
}
