// Gera icefishing-data.js a partir de source/game_fish_data.h do gopenguin-3ds
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('E:/project/gopenguin-3ds-main/source/game_fish_data.h', 'utf8');

const grab = (name) => {
  const m = src.match(new RegExp(name + '\\s*(?:\\[[^\\]]*\\])*\\s*=\\s*(\\{[\\s\\S]*?\\});', ''));
  return m ? m[1] : null;
};

// FISH_OBJECTS
const objects = [...src.matchAll(/"(fish\d|oneup|jfish\d|fin(?:Left|Right)|crab\d|kicker(?:Left|Right)|grayfish\d)"/g)].map(m => m[1]);
// dedup preservando ordem
const FISH_OBJECTS = [...new Set(objects)];

// FISH_GROUPS [n][2]
const groupsBlob = grab('FISH_GROUPS');
const FISH_GROUPS = groupsBlob ? [...groupsBlob.matchAll(/\{(\d+),(\d+)\}/g)].map(m => [+m[1], +m[2]]) : [];

// FISH_EVENTS [n][2]
const eventsBlob = grab('FISH_EVENTS');
const FISH_EVENTS = eventsBlob ? [...eventsBlob.matchAll(/\{(\d+),(\d+)\}/g)].map(m => [+m[1], +m[2]]) : [];

// FISH_HITBOX / FISH_LINE_BOX
const num = (s) => parseFloat(String(s).replace(/[fF]$/, ''));
const hit = src.match(/FISH_HITBOX\[4\]=\{([^}]*)\}/)[1].split(',').map(num);
const lineM = src.match(/FISH_LINE_BOX\[2\]\[4\]=\{\{([^}]*)\},\{([^}]*)\}\}/);
const FISH_LINE_BOX = [lineM[1].split(',').map(num), lineM[2].split(',').map(num)];

// FISH_ROOTS: {"name",{a,b,c,d,x,y}}
const rootsBlob = grab('FISH_ROOTS');
const FISH_ROOTS = [...rootsBlob.matchAll(/\{"(\w+)",\{([-\d.eEfF]+),([-\d.eEfF]+),([-\d.eEfF]+),([-\d.eEfF]+),([-\d.eEfF]+),([-\d.eEfF]+)\}\}/g)]
  .map(m => ({ name: m[1], matrix: [2,3,4,5,6,7].map(i => num(m[i])) }));

// FISH_TEXT {"key","value"}
const FISH_TEXT = [...src.matchAll(/\{"(\w+)","((?:[^"\\]|\\.)*)"\}/g)].map(m => [m[1], m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')]);

const out = `// GERADO por tools/gen-fish-data.mjs a partir de gopenguin-3ds/source/game_fish_data.h
// NAO EDITAR MANUALMENTE
export const FISH_OBJECTS = ${JSON.stringify(FISH_OBJECTS)};
export const FISH_GROUPS = ${JSON.stringify(FISH_GROUPS)};
export const FISH_EVENTS = ${JSON.stringify(FISH_EVENTS)};
export const FISH_HITBOX = ${JSON.stringify(hit)};
export const FISH_LINE_BOX = ${JSON.stringify(FISH_LINE_BOX)};
export const FISH_ROOTS = ${JSON.stringify(FISH_ROOTS)};
export const FISH_TEXT = ${JSON.stringify(FISH_TEXT)};
`;
writeFileSync('client/src/minigames/icefishing/icefishing-data.js', out);
console.log('objects:', FISH_OBJECTS.length, 'groups:', FISH_GROUPS.length, 'events:', FISH_EVENTS.length, 'roots:', FISH_ROOTS.length, 'texts:', FISH_TEXT.length);
