const fs=require('fs'),path=require('path');
const dir='E:/project/club-penguin-browser/client/public/assets/movies';
const LANGS=['english','portuguese','french','spanish'];
for(const pack of fs.readdirSync(dir)){
  const f=path.join(dir,pack,'timelines.json');
  if(!fs.existsSync(f))continue;
  const j=JSON.parse(fs.readFileSync(f,'utf8'));
  let n=0,sus=[];
  for(const [id,sp] of Object.entries(j.sprites||{})){
    const l=sp.labels||{};
    if(LANGS.some(x=>l[x]!==undefined)){
      n++;
      const maxLabel=Math.max(...LANGS.map(x=>l[x]??0));
      if(sp.frames.length>LANGS.length||maxLabel!==sp.frames.length) sus.push(id+':f'+sp.frames.length+'@'+maxLabel);
    }
  }
  if(n)console.log(pack,'lang-sprites:',n,'suspicious:',sus.join(' '));
}
