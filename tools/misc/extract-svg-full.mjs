import { readFileSync } from 'fs';
const packPath = 'client/public/assets/icons/402/chars/chars.pack';
const buf = readFileSync(packPath);
const off = 0, len = 2798;
const svg = buf.slice(off, off + len).toString('utf-8');
console.log(svg);
