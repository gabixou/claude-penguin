// Extrai o stream MP3 de tags DefineSound (14) dentro de um SWF.
// Uso: node tools/extract-swf-mp3.mjs <in.swf> <out.mp3> [--all]
import fs from 'node:fs';
import zlib from 'node:zlib';

const [inPath, outPath, ...rest] = process.argv.slice(2);
const wantAll = rest.includes('--all');
let buf = fs.readFileSync(inPath);
if (buf.toString('latin1', 0, 3) === 'CWS') {
    buf = Buffer.concat([buf.subarray(0, 8), zlib.inflateSync(buf.subarray(8))]);
}
if (buf.toString('latin1', 0, 3) !== 'FWS' && buf.toString('latin1', 0, 3) !== 'CWS') {
    console.error('not a SWF'); process.exit(1);
}
// anda os tags SWF
const nbits = buf[8] >> 3;
const rectBytes = Math.ceil((5 + nbits * 4) / 8);
let off = 8 + rectBytes + 4;
const sounds = [];
while (off < buf.length - 2) {
    const h = buf.readUInt16LE(off); off += 2;
    const type = h >> 6;
    let L = h & 0x3f;
    if (L === 0x3f) { L = buf.readUInt32LE(off); off += 4; }
    if (type === 0) break; // End
    if (type === 14) { // DefineSound
        const payload = buf.subarray(off, off + L);
        // MP3: SoundFormat=2 (mp3) no byte de flags; dados comecam apos
        // SoundId(2)+fmt(1)+rate/size/type(1)+SampleCount(4) = 8 bytes
        // acha primeiro sync 0xFF Fx dentro do payload
        let s = -1;
        for (let i = 8; i < payload.length - 1; i++) {
            if (payload[i] === 0xFF && (payload[i + 1] & 0xE0) === 0xE0) { s = i; break; }
        }
        if (s >= 0) sounds.push(payload.subarray(s));
    }
    off += L;
}
if (!sounds.length) { console.log('NO SOUNDS'); process.exit(2); }
console.log('sounds found:', sounds.length, sounds.map(s => s.length));
if (wantAll) {
    sounds.forEach((s, i) => fs.writeFileSync(outPath.replace(/\.mp3$/, '') + '_' + i + '.mp3', s));
} else {
    // concatena (multiplos streams = multiplas faixas; toca a primeira por padrao)
    fs.writeFileSync(outPath, sounds[0]);
}
console.log('wrote', outPath);
