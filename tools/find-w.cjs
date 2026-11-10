const fs=require('fs');
const src=fs.readFileSync('gp-index.js','utf8');
// W is the Movie/loader class. find "shared(" definition and load()
for(const pat of ['shared(','static async load','asClip','Movie.load','class W','W={']){
  let i=src.indexOf(pat);
  if(i>=0){console.log('>>>',pat,'@',i);console.log(src.slice(Math.max(0,i-300),i+700));console.log('=====');}
}
