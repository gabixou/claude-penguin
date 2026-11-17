import fs from 'fs';
const s = fs.readFileSync(new URL('./gp-main.js', import.meta.url), 'utf8');
for (const t of ['adopt_catalogue', 'pets_catalogue', 'adoptPuffle', 'puffle', 'pet_']) {
    let i = -1, c = 0;
    while ((i = s.indexOf(t, i + 1)) >= 0 && c < 8) {
        console.log('==', t, '@', i);
        console.log(s.slice(Math.max(0, i - 200), i + 250));
        c++;
    }
}
