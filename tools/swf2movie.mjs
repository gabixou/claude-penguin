#!/usr/bin/env node
// swf2movie.mjs — converte um .swf (AS2) para o formato "movie" que o
// cliente consome (timelines.json + chars/*.pack com os SVGs), o mesmo
// formato das salas, catalogos e do Ice Fishing.
//
// Usa o JPEXS FFDec (Java) para: swf -> XML das tags, exportar shapes,
// morphshapes e textos em SVG, fontes em TTF e os scripts AS2 decompilados.
// Este script monta as display lists por frame (PlaceObject/RemoveObject),
// botoes, edit texts, fontes, exports, labels e acoes.
//
// Uso:
//   node tools/swf2movie.mjs <arquivo.swf> <pasta-destino> [--ffdec <ffdec-cli.jar>] [--java <java.exe>]
//   (padrao: C:\dev\swf-tools\ffdec\ffdec-cli.jar e o java em C:\dev\swf-tools\jre)
// Ex.: node tools/swf2movie.mjs C:\dev\swf-tools\swf\FindFour.swf client/public/assets/movies/games/four

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const TOOLS = 'C:\\dev\\swf-tools';
const FFDEC = opt('--ffdec', path.join(TOOLS, 'ffdec', 'ffdec-cli.jar'));
const JAVA = opt('--java', (() => {
    const jre = path.join(TOOLS, 'jre');
    const d = fs.existsSync(jre) ? fs.readdirSync(jre).find((x) => fs.existsSync(path.join(jre, x, 'bin', 'java.exe'))) : null;
    return d ? path.join(jre, d, 'bin', 'java.exe') : 'java';
})());
const [swfPath, outDir] = args;
if (!swfPath || !outDir) { console.error('uso: node tools/swf2movie.mjs <arquivo.swf> <pasta-destino>'); process.exit(1); }

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'swf2movie-'));
const xmlPath = path.join(work, 'swf.xml');
const exp = path.join(work, 'export');
const ffdec = (...a) => execFileSync(JAVA, ['-jar', FFDEC, ...a], { stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 28 });
console.log('[swf2movie] FFDec: XML...');
ffdec('-swf2xml', swfPath, xmlPath);
console.log('[swf2movie] FFDec: shapes, textos, fontes e scripts...');
ffdec('-format', 'shape:svg,morphshape:svg,text:svg,font:ttf', '-export', 'shape,morphshape,text,font,script', exp, swfPath);

// ---------------------------------------------------------------- XML minimo
// O XML do FFDec so tem elementos com atributos e texto simples.
function parseXml(src) {
    const root = { tag: '#root', attrs: {}, kids: [], text: '' };
    const stack = [root];
    const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
    const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
    let m;
    const body = src.replace(/<\?xml[^>]*\?>/, '');
    while ((m = re.exec(body))) {
        if (m[5] !== undefined) { stack[stack.length - 1].text += unesc(m[5]); continue; }
        const [, close, tag, rawAttrs, selfClose] = m;
        if (close) { stack.pop(); continue; }
        const attrs = {};
        for (const a of rawAttrs.matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs[a[1]] = unesc(a[2]);
        const node = { tag, attrs, kids: [], text: '' };
        stack[stack.length - 1].kids.push(node);
        if (!selfClose) stack.push(node);
    }
    return root;
}
const kid = (n, tag) => n?.kids.find((k) => k.tag === tag) || null;
const items = (n) => (n ? n.kids.filter((k) => k.tag === 'item') : []);
const num = (v, d = 0) => (v === undefined || v === '' ? d : Number(v));
const bool = (v) => v === 'true';
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const tw = (v) => Math.round(num(v) / 20 * 100) / 100; // twips -> px

const swf = kid(parseXml(fs.readFileSync(xmlPath, 'utf8')), 'swf');
const tags = items(kid(swf, 'tags'));

function matrixOf(n) {
    if (!n) return null;
    const a = bool(n.attrs.hasScale) ? num(n.attrs.scaleX, 1) : 1;
    const d = bool(n.attrs.hasScale) ? num(n.attrs.scaleY, 1) : 1;
    const b = bool(n.attrs.hasRotate) ? num(n.attrs.rotateSkew0) : 0;
    const c = bool(n.attrs.hasRotate) ? num(n.attrs.rotateSkew1) : 0;
    return [r6(a), r6(b), r6(c), r6(d), tw(n.attrs.translateX), tw(n.attrs.translateY)];
}
function colorOf(n) {
    if (!n) return null;
    const A = n.attrs;
    const mult = bool(A.hasMultTerms) ? [A.redMultTerm, A.greenMultTerm, A.blueMultTerm, A.alphaMultTerm ?? 256].map((v) => num(v, 256) / 256) : [1, 1, 1, 1];
    const add = bool(A.hasAddTerms) ? [A.redAddTerm, A.greenAddTerm, A.blueAddTerm, A.alphaAddTerm ?? 0].map((v) => num(v)) : [0, 0, 0, 0];
    if (mult.every((v) => v === 1) && add.every((v) => v === 0)) return null;
    return { mult, add };
}

// ---------------------------------------------------------------- scripts AS2
const scriptsDir = path.join(exp, 'scripts');
const readAs = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
function frameActions(dirName) {
    const dir = path.join(scriptsDir, dirName);
    const out = {};
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir)) {
        const m = /^frame_(\d+)$/.exec(f);
        if (!m) continue;
        const src = readAs(path.join(dir, f, 'DoAction.as'));
        if (src) out[m[1]] = { source: src };
    }
    return out;
}
const spriteDirs = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir) : [];
const dirFor = (kind, id) => spriteDirs.find((d) => d === `${kind}_${id}` || d.startsWith(`${kind}_${id}_`));

// ---------------------------------------------------------------- timelines
function buildTimeline(subtags, actions) {
    const frames = [], labels = {}, scriptFrames = [];
    const dl = new Map();
    let frame = 1;
    for (const t of subtags) {
        const A = t.attrs;
        switch (A.type) {
            case 'PlaceObjectTag':
            case 'PlaceObject2Tag':
            case 'PlaceObject3Tag': {
                const depth = num(A.depth);
                const hasChar = A.type === 'PlaceObjectTag' || bool(A.placeFlagHasCharacter);
                const move = bool(A.placeFlagMove);
                const prev = dl.get(depth);
                let e = move && prev ? { ...prev } : { depth };
                if (hasChar) {
                    const id = num(A.characterId);
                    if (!move || !prev || prev.id !== id) { e = move && prev ? { ...prev, id } : { depth, id }; if (!move) delete e.ratio; }
                }
                const mx = matrixOf(kid(t, 'matrix'));
                if (mx) e.matrix = mx; else if (!e.matrix) e.matrix = [1, 0, 0, 1, 0, 0];
                const col = colorOf(kid(t, 'colorTransform'));
                if (col) e.color = col;
                if (bool(A.placeFlagHasName) && A.name) e.name = A.name;
                if (bool(A.placeFlagHasRatio) && A.ratio !== undefined) e.ratio = num(A.ratio);
                if (bool(A.placeFlagHasClipDepth)) e.clipDepth = num(A.clipDepth);
                if (bool(A.placeFlagHasVisible) && A.visible === '0') e.visible = false;
                if (e.id !== undefined) dl.set(depth, e);
                break;
            }
            case 'RemoveObjectTag':
            case 'RemoveObject2Tag':
                dl.delete(num(A.depth));
                break;
            case 'FrameLabelTag':
                if (A.name && labels[A.name] === undefined) labels[A.name] = frame;
                break;
            case 'DoActionTag':
                if (!scriptFrames.includes(frame)) scriptFrames.push(frame);
                break;
            case 'ShowFrameTag':
                frames.push([...dl.values()].sort((x, y) => x.depth - y.depth).map((e) => structuredClone(e)));
                frame++;
                break;
            default:
        }
    }
    if (!frames.length) frames.push([...dl.values()].sort((x, y) => x.depth - y.depth));
    return { frames, labels, scriptFrames, sounds: [], actions };
}

// ---------------------------------------------------------------- personagens
const characters = {}, sprites = {}, fonts = {}, editTexts = {}, scalingGrids = {}, exportsMap = {}, buttonActions = {};
const svgFiles = new Map(); // nome no pack -> conteudo
const fontFiles = new Map();

function svgMeta(file) {
    const s = fs.readFileSync(file, 'utf8');
    const w = parseFloat(/width="([\d.]+)px"/.exec(s)?.[1] || '0');
    const h = parseFloat(/height="([\d.]+)px"/.exec(s)?.[1] || '0');
    const m = /<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+),\s*([-\d.]+)\)"/.exec(s);
    return { s, size: [w, h], origin: m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0] };
}
function addSvg(kind, folder, id) {
    const f = path.join(exp, folder, `${id}.svg`);
    if (!fs.existsSync(f)) return false;
    const { s, size, origin } = svgMeta(f);
    svgFiles.set(`${id}.svg`, s);
    characters[id] = { kind, file: `${id}.svg`, size, origin };
    return true;
}

const BTN_STATES = [['up', 'buttonStateUp'], ['over', 'buttonStateOver'], ['down', 'buttonStateDown'], ['hittest', 'buttonStateHitTest']];
for (const t of tags) {
    const A = t.attrs;
    const T = A.type || '';
    if (/^DefineShape\d?Tag$/.test(T)) addSvg('shape', 'shapes', num(A.shapeId));
    else if (/^DefineMorphShape\d?Tag$/.test(T)) addSvg('morphshape', 'morphshapes', num(A.characterId));
    else if (/^DefineText\d?Tag$/.test(T)) addSvg('text', 'texts', num(A.characterID ?? A.characterId));
    else if (T === 'DefineEditTextTag') {
        const id = num(A.characterID);
        const b = kid(t, 'bounds')?.attrs || {};
        const c = kid(t, 'textColor')?.attrs;
        const hex = c ? '#' + [c.red, c.green, c.blue].map((v) => num(v).toString(16).padStart(2, '0')).join('') : '#000000';
        editTexts[id] = {
            bounds: [tw(b.Xmin), tw(b.Ymin), tw(b.Xmax), tw(b.Ymax)],
            font: bool(A.hasFont) ? num(A.fontId) : null,
            size: tw(A.fontHeight),
            color: hex, alpha: c ? num(c.alpha, 255) / 255 : 1,
            align: ['left', 'right', 'center', 'justify'][num(A.align)] || 'left',
            multiline: bool(A.multiline), wordWrap: bool(A.wordWrap), html: bool(A.html),
            outlines: bool(A.useOutlines), leading: tw(A.leading),
            margins: [tw(A.leftMargin), tw(A.rightMargin)],
            text: A.initialText || '', variable: A.variableName || '',
        };
        if (!addSvg('text', 'texts', id)) {
            characters[id] = { kind: 'text', size: [tw(b.Xmax) - tw(b.Xmin), tw(b.Ymax) - tw(b.Ymin)], origin: [-tw(b.Xmin), -tw(b.Ymin)] };
        }
    } else if (/^DefineFont\d?Tag$/.test(T)) {
        const id = num(A.fontID ?? A.fontId);
        const fdir = path.join(exp, 'fonts');
        const ff = fs.existsSync(fdir) ? fs.readdirSync(fdir).find((x) => x.startsWith(`${id}_`) && x.endsWith('.ttf')) : null;
        if (ff) {
            fontFiles.set(`font_${id}.ttf`, fs.readFileSync(path.join(fdir, ff)));
            fonts[id] = { name: A.fontName || ff.replace(/^\d+_|\.ttf$/g, ''), bold: bool(A.fontFlagsBold), italic: bool(A.fontFlagsItalic), file: `font_${id}.ttf` };
        }
    } else if (/^DefineButton2?Tag$/.test(T)) {
        const id = num(A.buttonId);
        const records = { up: [], over: [], down: [], hittest: [] };
        for (const r of items(kid(t, 'characters'))) {
            if (r.attrs.type !== 'BUTTONRECORD') continue;
            const e = { depth: num(r.attrs.placeDepth), id: num(r.attrs.characterId) };
            const mx = matrixOf(kid(r, 'placeMatrix'));
            if (mx && mx.join() !== '1,0,0,1,0,0') e.matrix = mx;
            const col = colorOf(kid(r, 'colorTransform'));
            if (col) e.color = col;
            for (const [st, flag] of BTN_STATES) if (bool(r.attrs[flag])) records[st].push({ ...e });
        }
        characters[id] = { kind: 'button', records };
        const dir = dirFor('DefineButton2', id) || dirFor('DefineButton', id);
        if (dir) {
            const acts = {};
            for (const f of fs.readdirSync(path.join(scriptsDir, dir))) {
                const m = /on\(([^)]*)\)\.as$/.exec(f);
                if (!m) continue;
                const src = readAs(path.join(scriptsDir, dir, f));
                for (const ev of m[1].split(',').map((x) => x.trim())) {
                    const key = { release: 'release', press: 'press', rollOver: 'rollOver', rollOut: 'rollOut', releaseOutside: 'releaseOutside', dragOver: 'dragOver', dragOut: 'dragOut' }[ev] || ev;
                    acts[key] = src;
                }
            }
            if (Object.keys(acts).length) buttonActions[id] = acts;
        }
    } else if (T === 'DefineSpriteTag') {
        const id = num(A.spriteId);
        const dir = dirFor('DefineSprite', id);
        sprites[id] = buildTimeline(items(kid(t, 'subTags')), dir ? frameActions(dir) : {});
    } else if (T === 'DefineScalingGridTag') {
        const r = kid(t, 'splitter')?.attrs || {};
        scalingGrids[num(A.characterId)] = [tw(r.Xmin), tw(r.Ymin), tw(r.Xmax), tw(r.Ymax)];
    } else if (T === 'ExportAssetsTag') {
        const ids = items(kid(t, 'tags')).map((x) => num(x.text));
        const names = items(kid(t, 'names')).map((x) => x.text);
        ids.forEach((cid, i) => { exportsMap[cid] = names[i]; });
    }
}

const main = buildTimeline(tags, frameActions('.'));
// scripts do frame principal ficam em scripts/frame_N
Object.assign(main.actions, frameActions(''));
const bg = tags.find((t) => t.attrs.type === 'SetBackgroundColorTag');
const bgc = kid(bg, 'backgroundColor')?.attrs;
const rect = kid(swf, 'displayRect')?.attrs || {};

// ---------------------------------------------------------------- packs
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'chars'), { recursive: true });
const CHUNK = 256 * 1024;
const chunkFiles = [], chunkEntries = {};
let parts = [], size = 0, names = [];
const flush = () => {
    if (!parts.length) return;
    const buf = Buffer.concat(parts);
    const name = `chunk-${chunkFiles.length}-${createHash('sha256').update(buf).digest('hex').slice(0, 8)}.pack`;
    fs.writeFileSync(path.join(outDir, 'chars', name), buf);
    let off = 0;
    for (const [file, len] of names) { chunkEntries[file] = [chunkFiles.length, off, len]; off += len; }
    chunkFiles.push(name);
    parts = []; size = 0; names = [];
};
for (const [file, s] of [...svgFiles].sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    const buf = Buffer.from(s, 'utf8');
    if (size + buf.length > CHUNK) flush();
    parts.push(buf); names.push([file, buf.length]); size += buf.length;
}
flush();
for (const [file, buf] of fontFiles) fs.writeFileSync(path.join(outDir, 'chars', file), buf);

const timelines = {
    source: createHash('sha256').update(fs.readFileSync(swfPath)).digest('hex'),
    stage: {
        width: tw(rect.Xmax) - tw(rect.Xmin), height: tw(rect.Ymax) - tw(rect.Ymin),
        frameRate: num(swf.attrs.frameRate, 24), frames: main.frames.length,
        background: bgc ? '#' + [bgc.red, bgc.green, bgc.blue].map((v) => num(v).toString(16).padStart(2, '0')).join('') : '#ffffff',
    },
    exports: exportsMap,
    main: { frames: main.frames, labels: main.labels, actions: main.actions, scriptFrames: main.scriptFrames, sounds: [] },
    sprites, characters, fonts, editTexts, scalingGrids, buttonActions,
    chunks: { files: chunkFiles, entries: chunkEntries },
};
fs.writeFileSync(path.join(outDir, 'timelines.json'), JSON.stringify(timelines));
fs.rmSync(work, { recursive: true, force: true });
console.log(`[swf2movie] ${path.basename(swfPath)} -> ${outDir}: ${main.frames.length} frames, ${Object.keys(sprites).length} sprites, ${Object.keys(characters).length} personagens, ${svgFiles.size} SVGs em ${chunkFiles.length} chunk(s), ${fontFiles.size} fonte(s)`);
