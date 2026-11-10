const fs=require('fs');
const src=fs.readFileSync('gp-index.js','utf8');
// find definition of He( - could be "He=" or "function He" or "const He"
for(const pat of ['He=','function He','He=async','let He','const He','var He']){
  let i=src.indexOf(pat);
  while(i>=0){
    console.log('>>>',pat,'@',i);
    console.log(src.slice(Math.max(0,i-200),i+600));
    console.log('=====');
    i=src.indexOf(pat,i+1);
    break;
  }
}
