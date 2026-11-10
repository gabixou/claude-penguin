// analise basica dos mp3s: duracao, zcr, centroid aprox via decode? sem deps.
// MP3 nao da pra decodificar sem lib — uso tamanho como proxy + header check.
import fs from 'node:fs';
const dir='client/public/assets/sfx/town';
for(const f of fs.readdirSync(dir).sort()){
  const b=fs.readFileSync(dir+'/'+f);
  // conta frames MP3 (sync 0xFF Ex) -> estimativa de duracao real
  let frames=0;
  for(let i=0;i<b.length-1;i++) if(b[i]===0xFF&&(b[i+1]&0xE0)===0xE0) frames++;
  console.log(f, b.length+'B', 'syncs:'+frames);
}
