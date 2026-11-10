import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const dir = 'E:/project/club-penguin-browser/client/public/assets/rooms/';
for (const f of fs.readdirSync(dir)) {
    const img = decodePNG(fs.readFileSync(dir + f));
    let cnt = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * 4, r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
        if (g > 180 && g > r + 60 && g > b + 60) {
            cnt++;
            if (x < minx) minx = x; if (x > maxx) maxx = x;
            if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
    }
    console.log(f.padEnd(12), 'greenish=', cnt, cnt ? ('bbox ' + minx + ',' + miny + ' -> ' + maxx + ',' + maxy) : '');
}
