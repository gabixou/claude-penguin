import zlib from 'node:zlib';
import fs from 'node:fs';

export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let pos = 8, w=0,h=0,bitDepth=8,colorType=6,idat=[];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos+4, pos+8);
    const data = buf.subarray(pos+8, pos+8+len);
    if (type==='IHDR'){ w=data.readUInt32BE(0); h=data.readUInt32BE(4); bitDepth=data[8]; colorType=data[9]; }
    else if (type==='IDAT') idat.push(data);
    else if (type==='IEND') break;
    pos += 12+len;
  }
  const ch = colorType===6?4:colorType===2?3:1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w*ch;
  const out = Buffer.alloc(h*stride);
  let p=0;
  for(let y=0;y<h;y++){
    const f=raw[p++]; const row=raw.subarray(p,p+stride); p+=stride;
    const prev = y>0? out.subarray((y-1)*stride,y*stride):Buffer.alloc(stride);
    const cur = out.subarray(y*stride,(y+1)*stride);
    for(let x=0;x<stride;x++){
      const a=x>=ch?cur[x-ch]:0, b=prev[x], c=x>=ch?prev[x-ch]:0;
      let v=row[x];
      if(f===1)v=(v+a)&255; else if(f===2)v=(v+b)&255; else if(f===3)v=(v+((a+b)>>1))&255;
      else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255;}
      cur[x]=v;
    }
  }
  return {w,h,ch,data:out};
}

export function encodePNG(w,h,ch,pixels){
  const stride=w*ch; const raw=Buffer.alloc(h*(stride+1));
  for(let y=0;y<h;y++){raw[y*(stride+1)]=0;pixels.copy?pixels.copy(raw,y*(stride+1)+1,(y*stride),(y+1)*stride):raw.set(pixels.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);}
  const idat=zlib.deflateSync(raw,{level:9});
  const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(zlib.crc32?zlib.crc32(td):crc32(td)>>>0);return Buffer.concat([l,td,c]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=ch===4?6:ch===3?2:0;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);
}
function crc32(buf){let t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}let c=0xffffffff;for(const b of buf)c=t[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}

if (process.argv[1] && process.argv[1].endsWith('png.mjs')===false){}
