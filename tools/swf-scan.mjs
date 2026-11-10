import fs from 'node:fs';
import zlib from 'node:zlib';
const f = process.argv[2];
let buf = fs.readFileSync(f);
if (buf.toString('latin1', 0, 3) === 'CWS') buf = Buffer.concat([buf.subarray(0, 8), zlib.inflateSync(buf.subarray(8))]);
console.log('size', buf.length, 'sig', buf.toString('latin1', 0, 3));
for (const needle of ['MP3', 'Nelly', 'ADPCM', 'SoundStream', 'DefineSound', 'LAME', 'Lavf', 'Xing', 'Info', 'ID3', 'RIFF', 'OggS', 'fLaC']) {
  const b = Buffer.from(needle, 'latin1');
  let i = buf.indexOf(b);
  console.log(needle, i >= 0 ? '@' + i : '-');
}
// conta tags SWF: header 8 + RECT variavel
// RECT: primeiro byte >>3 = Nbits
const nbits = buf[8] >> 3;
const rectBytes = Math.ceil((5 + nbits * 4) / 8);
let off = 8 + rectBytes + 4; // + framerate(2)+framecount(2)
console.log('tags start ~', off);
const counts = {};
for (let k = 0; k < 60 && off < buf.length - 2; k++) {
  const h = buf.readUInt16LE(off); off += 2;
  const type = h >> 6, len = h & 0x3f;
  let L = len;
  if (len === 0x3f) { L = buf.readUInt32LE(off); off += 4; }
  counts[type] = (counts[type] || 0) + 1;
  if (type === 14 || type === 18 || type === 19 || type === 45) {
    console.log('tag', type, 'len', L, 'at', off, 'head:', buf.subarray(off, off + Math.min(32, L)).toString('hex'));
  }
  off += L;
}
console.log('tag counts:', JSON.stringify(counts));
