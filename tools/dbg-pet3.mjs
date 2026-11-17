import fs from 'fs';
const s = fs.readFileSync(new URL('./gp-main.js', import.meta.url), 'utf8');
for (const t of ['puffleCard', 'puffles.set', 'class.*[Pp]uffle', 'pet_area', 'walkPuffle', 'puffle_']) {
    let i = -1, c = 0;
    while ((i = s.indexOf(t, i + 1)) >= 0 && c < 6) {
        console.log('==', t, '@', i);
        console.log(s.slice(Math.max(0, i - 150), i + 300).replace(/\n/g, ' '));
        c++;
    }
}
