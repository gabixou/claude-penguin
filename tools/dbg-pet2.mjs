import fs from 'fs';
const s = fs.readFileSync(new URL('./gp-main.js', import.meta.url), 'utf8');
// adoptPuffle completo
let i = s.indexOf('adoptPuffle(e,t){');
console.log('=== adoptPuffle ===');
console.log(s.slice(i, i + 3000));
