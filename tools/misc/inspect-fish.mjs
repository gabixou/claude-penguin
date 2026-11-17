import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('client/public/assets/movies/games/fish/IceFishing/timelines.json', 'utf8'));
console.log('keys:', Object.keys(d));
console.log('sprites:', Object.keys(d.sprites || {}).length, 'chars:', Object.keys(d.characters || {}));
const names = ['fish1','fish2','fish3','fish4','fish5','fish6','fish7','fish8','grayfish1','grayfish2','grayfish3','grayfish4','sharkLeft','sharkRight','crab1','crab2','jfish1','jfish2','oneup','puffle','bigFish','line','hook','penguin','icebox','finLeft','finRight','kickerLeft','kickerRight','fishflee','grayfishflee','oneupText','bigFishApproach'];
// sprite ids may be numeric; find frames entries by name in main
const main = d.main || d.sprites?.[d.mainId];
console.log('main keys:', main ? Object.keys(main) : 'none');
if (main?.frames) {
  for (const [i, fr] of main.frames.entries()) {
    const named = fr.filter(e => e.name);
    if (named.length) console.log('frame', i, named.map(e => `${e.name}#${e.id}`).join(', '));
  }
}
console.log('sprite sample:', JSON.stringify(Object.entries(d.sprites || {})[0]).slice(0, 300));
console.log('actions?', !!d.actions, 'labels?', !!d.labels);
