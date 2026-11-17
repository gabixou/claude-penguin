const fs = require('fs');
const path = 'E:/project/club-penguin-browser/client/public/minigames/icefishing/script.js';
let s = fs.readFileSync(path, 'utf8');
const names = ['fluffy', 'grey', 'mullet', 'boot', 'barrel', 'jellyfish', 'can', 'shark'];
let i = 0;
s = s.replace(/this\.direction = genDirect\(\);/g, () => {
  const n = names[i++];
  return `this.direction = genDirect();\n  this.direction2 = genDirect();\n  this.name = "${n}";`;
});
fs.writeFileSync(path, s);
console.log('patched', i, 'constructors');
