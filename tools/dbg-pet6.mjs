import fs from 'fs';
const s = fs.readFileSync(new URL('./gp-main.js', import.meta.url), 'utf8');
let i = s.indexOf('openPuffle(e){');
console.log(s.slice(i, i + 5200));
