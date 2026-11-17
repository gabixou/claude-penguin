import { readFileSync } from 'fs';
import { join } from 'path';
const dir = 'client/public/assets/movies/games/fish/IceFishing';
const tl = JSON.parse(readFileSync(join(dir, 'timelines.json'), 'utf8'));
console.log('chunks isArray:', Array.isArray(tl.chunks));
console.log('chunks keys:', Object.keys(tl.chunks ?? {}));
console.log('chunks.files:', JSON.stringify(tl.chunks?.files)?.slice(0, 200));
console.log('chunks.entries sample:', JSON.stringify(Object.entries(tl.chunks?.entries ?? {}).slice(0, 3)));
console.log('chunks raw head:', JSON.stringify(tl.chunks).slice(0, 300));
// comparar com outro movie que funciona (ex.: um room)
const roomTl = JSON.parse(readFileSync('client/public/assets/movies/rooms/town/timelines.json', 'utf8'));
console.log('--- town ---');
console.log('town chunks isArray:', Array.isArray(roomTl.chunks), 'keys:', Object.keys(roomTl.chunks ?? {}));
console.log('town chunks.files:', JSON.stringify(roomTl.chunks?.files)?.slice(0, 150));
console.log('town chunks.entries sample:', JSON.stringify(Object.entries(roomTl.chunks?.entries ?? {}).slice(0, 2)));
