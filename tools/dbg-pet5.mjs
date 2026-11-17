import fs from 'fs';
const s = fs.readFileSync(new URL('./gp-main.js', import.meta.url), 'utf8');
// classe da entidade puffle — antes de @157895 tem o draw/step/follow
console.log(s.slice(156200, 158900));
