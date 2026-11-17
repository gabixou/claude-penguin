import fs from 'fs';
const s = fs.readFileSync(new URL('./gp-main.js', import.meta.url), 'utf8');
const i = s.indexOf('buddy_mc",{frame:E?3:H?1:2}');
console.log('idx', i);
console.log(s.slice(i - 3000, i + 900));
