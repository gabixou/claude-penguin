// lista tags SWF com tipos e tamanhos — uso: node swf-tags.mjs file.swf
import fs from 'node:fs';
import zlib from 'node:zlib';
let buf = fs.readFileSync(process.argv[2]);
if (buf.toString('latin1', 0, 3) === 'CWS') buf = Buffer.concat([buf.subarray(0, 8), zlib.inflateSync(buf.subarray(8))]);
const NAMES = {0:'End',1:'ShowFrame',2:'DefineShape',3:'PlaceObject',4:'RemoveObject',5:'DefineBits',6:'DefineButton',7:'JPEGTables',8:'SetBackgroundColor',9:'DefineFont',10:'DefineText',11:'DoAction',12:'DefineFontInfo',13:'DefineSound',14:'StartSound',15:'DefineButtonSound',17:'DefineBinaryData',18:'DefineFont2',19:'DefineFont3',20:'DefineText2',21:'ExportAssets',22:'ImportAssets',23:'EnableDebugger',24:'DoInitAction',25:'DefineVideoStream',26:'VideoFrame',28:'DefineFontInfo2',32:'DefineShape2',33:'DefineButtonCxform',34:'Protect',35:'PlaceObject2',36:'RemoveObject2',37:'DefineShape3',38:'DefineText2?',39:'DefineSprite',40:'StartSound2?',43:'FrameLabel',45:'SoundStreamHead',46:'SoundStreamBlock',48:'DefineFont3?',56:'ExportAssets?',57:'ImportAssets?',58:'EnableTelemetry',59:'DoABC',60:'DefineShape4',61:'DefineMorphShape',62:'DefineFont4',64:'DefineFontAlignZones',65:'CSMTextSettings',66:'DefineFont3?',69:'FileAttributes',70:'PlaceObject3',71:'ImportAssets2',73:'DefineFontAlignZones?',75:'DefineFontName',82:'DoABC?',83:'DefineShape4?',87:'DefineBinaryData?',88:'DefineFontName?',90:'DefineBitsJPEG4',255:'DefineFont3?'};
const nbits = buf[8] >> 3;
const rectBytes = Math.ceil((5 + nbits * 4) / 8);
let off = 8 + rectBytes + 4;
const counts = {};
for (let k = 0; k < 200000 && off < buf.length - 2; k++) {
  const h = buf.readUInt16LE(off); off += 2;
  const type = h >> 6, len = h & 0x3f;
  let L = len;
  if (len === 0x3f) { L = buf.readUInt32LE(off); off += 4; }
  counts[type] = (counts[type] || 0) + 1;
  if (type === 39) console.log(`tag ${type} DefineSprite @${off} len=${L} head=${buf.subarray(off, off + 8).toString('hex')}`);
  if (type === 82 || type === 72) console.log(`tag ${type} DoABC @${off} len=${L}`);
  off += L;
  if (type === 0) break;
}
console.log('counts:', JSON.stringify(counts));
