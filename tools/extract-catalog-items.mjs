import fs from 'fs';
import path from 'path';
const DIR = 'client/public/assets/catalogues';
const BUY = /\b(buyInventory|buyFurniture|buyIgloo|buyFloor|buyIglooFloor|upgradeIgloo|upgradeIglooFloor|buyIglooUpgrade)\((\d+)/g;
const out = {};
for (const cat of fs.readdirSync(DIR)) {
  const f = path.join(DIR, cat, 'timelines.json');
  if (!fs.existsSync(f)) continue;
  const tl = JSON.parse(fs.readFileSync(f, 'utf8'));
  const ids = new Map(); // id -> kind
  const scan = (s) => { for (const m of String(s).matchAll(BUY)) ids.set(Number(m[2]), m[1]); };
  // buttonActions
  for (const a of Object.values(tl.buttonActions || {})) { scan(a.release); scan(a.rollOver); }
  // actions em main e sprites
  const scanActs = (acts) => { for (const a of Object.values(acts || {})) scan(typeof a === 'string' ? a : a?.source || ''); };
  scanActs(tl.main?.actions);
  for (const sp of Object.values(tl.sprites || {})) { scanActs(sp.actions); for (const fr of sp.frames || []) {} }
  out[cat] = [...ids.entries()].map(([id, k]) => ({ id, kind: k }));
}
fs.writeFileSync('tools/catalog-items.json', JSON.stringify(out, null, 1));
const all = new Set();
for (const [cat, items] of Object.entries(out)) { console.log(cat, items.length); items.forEach(i => all.add(i.id)); }
console.log('TOTAL unicos:', all.size);
