import fs from 'node:fs';
const cat = JSON.parse(fs.readFileSync('server/src/data/igloo-catalog.json', 'utf8'));
const furn = cat.furniture || cat.furnitures || [];
console.log('cat keys:', Object.keys(cat), 'furn type:', typeof furn, Array.isArray(furn) ? furn.length : Object.keys(furn).length);
const entries = Array.isArray(furn) ? furn.map(f => ({ id: f.id, ...f })) : Object.entries(furn).map(([k, v]) => ({ id: +k, ...v }));
const ids = entries.map(f => f.id);
const have = new Set(fs.readdirSync('client/public/assets/movies/furniture'));
const missing = ids.filter(i => !have.has(String(i)));
console.log('catalog', ids.length, 'have', have.size, 'missing', missing.length);
console.log(missing.slice(0, 100).join(','));
// check which missing have a source swf
const WAND = '/mnt/c/Users/GABS/wand/vanilla-media/media/play/v2/content/global/furniture/sprites';
const noSwf = missing.filter(i => !fs.existsSync(`${WAND}/${i}.swf`));
console.log('missing without swf:', noSwf.length, noSwf.slice(0, 50).join(','));
