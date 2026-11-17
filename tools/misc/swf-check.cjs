const fs=require('fs'),zlib=require('zlib');
const f=process.argv[2];
let b=fs.readFileSync(f);
try{if(b.toString('latin1',0,3)==='CWS')b=Buffer.concat([b.subarray(0,8),zlib.inflateSync(b.subarray(8))]);}catch(e){}
const s=b.toString('latin1');
console.log(f.split('/').slice(-2).join('/'), 'len='+b.length,
 'canopy:'+s.includes('dance_canopy_mc'),
 'sign:'+s.includes('nightclubsign'),
 'sign2:'+s.includes('sign2'),
 'disco_mc:'+s.includes('disco_mc'),
 'abc:'+s.includes('DoABC'));
