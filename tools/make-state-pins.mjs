#!/usr/bin/env node
// make-state-pins.mjs — pins com as bandeiras dos 26 estados brasileiros +
// Distrito Federal, no mesmo estilo dos pins de pais do Club Penguin.
//
// Gera (idempotente — pode rodar de novo apos ajustar um desenho):
//   - items.json: itens 9500..9526 (type 8 = pin, 20 moedas, como os paises)
//   - icons/<id>/ : pack do icone (inventario e player card) + icons/index.json
//   - catalogues/clothing-br/ : variante do catalogo de roupas em que as
//     paginas de bandeiras (19-20) mostram os estados. Reaproveita TODOS os
//     packs do catalogo original por caminho relativo; so os pins e rotulos
//     novos ficam num chunk proprio.
//
// Os rotulos usam os contornos da propria fonte do catalogo (Burbank Big
// Regular Bold, font_469.ttf) — a fonte extraida do SWF nao tem acentos,
// entao á/ã/í/ô sao montados com o glifo base + acento desenhado aqui.
//
// Uso: node tools/make-state-pins.mjs
// Depois: reinicie o servidor (ele le o items.json no boot).

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'client', 'public', 'assets');
const CAT = join(assets, 'catalogues', 'clothing');
const OUT_CAT = join(assets, 'catalogues', 'clothing-br');
const FIRST_ID = 9500;
const COST = 20;
const FLAG_PAGES = [19, 20]; // frames do 'book' com os pins de pais

// ---------------------------------------------------------------- bandeiras
// Coordenadas do pin: quadrado [-25,25] (y para baixo), recortado num
// circulo de raio 24.7 — como os pins de pais, o desenho da bandeira e
// comprimido no circulo.
const C = {
    green: '#00953c', yellow: '#ffd500', blue: '#1d3f91', red: '#d6261d',
    white: '#ffffff', black: '#151515', sky: '#2f6fc0', pink: '#f2a0b4',
};
const f = (n) => +n.toFixed(2);
const rect = (x, y, w, h, fill) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"/>`;
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
const circ = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
const star = (cx, cy, r, fill, n = 5, inner = 0.4, extra = '') => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
        const rr = i % 2 ? r * inner : r;
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    return poly(pts, fill, extra);
};
const hStripes = (colors) => colors.map((c, i) => rect(-25, -25 + (50 / colors.length) * i, 50, 50 / colors.length + 0.05, c)).join('');
const vStripes = (colors) => colors.map((c, i) => rect(-25 + (50 / colors.length) * i, -25, 50 / colors.length + 0.05, 50, c)).join('');
const field = (c) => rect(-26, -26, 52, 52, c);
const arc = (cx, cy, r, stroke, w) => `<path d="M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
const txt = (x, y, size, fill, s) => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}" text-anchor="middle" fill="${fill}">${s}</text>`;
// faixa diagonal "/" (do canto inferior esquerdo ao superior direito)
const bandUp = (w, fill) => poly([[-25, 25 - w], [25 - w, -25], [26, -25], [26, -25 + w], [-25 + w, 26], [-26, 26], [-26, 25 - w]], fill);
// faixa diagonal "\" (do canto superior esquerdo ao inferior direito)
const bandDown = (w, fill) => poly([[-26, -26], [-25 + w, -26], [26, 25 - w], [26, 26], [25 - w, 26], [-26, -25 + w]], fill);

const STATES = [
    ['AC', 'Acre', () => field(C.green)
        + poly([[-26, -26], [26, -26], [-26, 26]], C.yellow)
        + star(-11, -11, 7, C.red)],
    ['AL', 'Alagoas', () => vStripes([C.red, C.white, C.blue])
        + circ(0, 0, 6.8, 'none', `stroke="#c9a227" stroke-width="1.8"`)
        + circ(0, 0, 4.4, '#2e8b3a') + star(0, -0.3, 2.6, C.white)],
    ['AP', 'Amapá', () => rect(-26, -26, 52, 19, C.blue) + rect(-26, -7, 52, 3, C.black)
        + rect(-26, -4, 52, 5, C.white) + rect(-26, 1, 52, 25, C.green)
        + star(-9, -13, 5.8, C.white, 4, 0.5, `stroke="${C.black}" stroke-width="1"`)],
    ['AM', 'Amazonas', () => hStripes([C.white, C.red, C.white]) + rect(-26, -26, 27, 17.7, C.blue)
        + [[-12, -18], [-6.5, -18], [-1, -18], [-15, -12.5], [-9, -12.5], [-3, -12.5]].map(([x, y]) => star(x, y, 2, C.white)).join('')],
    ['BA', 'Bahia', () => hStripes([C.white, C.red, C.white, C.red]) + rect(-26, -26, 26, 26, C.blue)
        + poly([[-10.5, -19.5], [-17.5, -6.5], [-3.5, -6.5]], C.white)],
    ['CE', 'Ceará', () => field(C.green) + poly([[-23, 0], [0, -18], [23, 0], [0, 18]], C.yellow)
        + circ(0, 0, 9, C.white) + poly([[-4.2, -4.5], [4.2, -4.5], [4.2, 1], [0, 5.2], [-4.2, 1]], '#0f7a3a')
        + circ(0, -1, 1.7, C.yellow)],
    ['DF', 'Distrito Federal', () => field(C.white) + rect(-14, -14, 28, 28, '#0b7d3a')
        + [0, 90, 180, 270].map((a) => `<g transform="rotate(${a})">${poly([[0, -12.5], [-4.5, -5], [-1.6, -5], [-1.6, 0], [1.6, 0], [1.6, -5], [4.5, -5]], C.yellow)}</g>`).join('')],
    ['ES', 'Espírito Santo', () => hStripes([C.sky, C.white, C.pink])
        + txt(0, 1.4, 4.1, C.sky, 'TRABALHA E CONFIA')],
    ['GO', 'Goiás', () => hStripes([C.green, C.yellow, C.green, C.yellow, C.green, C.yellow, C.green, C.yellow])
        + rect(-26, -26, 24, 26, C.blue)
        + star(-11, -18.5, 2.3, C.white) + star(-11, -4.5, 2.6, C.white) + star(-17, -11, 2.1, C.white)
        + star(-5, -12, 2.1, C.white) + star(-8, -8, 1.3, C.white)],
    ['MA', 'Maranhão', () => hStripes([C.red, C.white, C.black, C.white, C.red, C.white, C.black, C.white, C.red])
        + rect(-26, -26, 26, 23.2, C.blue) + star(-11.5, -12.5, 5.2, C.white)],
    ['MT', 'Mato Grosso', () => field(C.blue) + poly([[-23, 0], [0, -19], [23, 0], [0, 19]], C.white)
        + circ(0, 0, 10, '#0b7d3a') + star(0, 0.6, 7.2, C.yellow)],
    ['MS', 'Mato Grosso do Sul', () => field(C.white) + poly([[26, -12], [26, 26], [-12, 26]], '#0b7d3a')
        + poly([[-26, -26], [12, -26], [-26, 12]], C.blue) + star(-12, -12, 5.8, C.yellow)],
    ['MG', 'Minas Gerais', () => field(C.white)
        + poly([[0, -16.5], [-14.5, 9.5], [14.5, 9.5]], 'none', `stroke="${C.red}" stroke-width="4.6" stroke-linejoin="miter"`)
        + txt(0, 18.5, 4, C.red, 'LIBERTAS')],
    ['PA', 'Pará', () => field(C.red) + bandUp(12, C.white) + star(0, 0, 6.8, C.blue)],
    ['PB', 'Paraíba', () => rect(-26, -26, 22, 52, C.red) + rect(-4, -26, 31, 52, C.black)
        // NEGO em destaque, centralizado no pin (contorno escuro para ler
        // tanto sobre o vermelho quanto sobre o preto)
        + `<text x="0" y="3.8" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900"`
        + ` font-size="10.6" text-anchor="middle" fill="${C.white}"`
        + ` stroke="#000000" stroke-width="1.6" stroke-linejoin="round" paint-order="stroke">NEGO</text>`],
    ['PR', 'Paraná', () => field('#0b7d3a') + bandDown(13, C.white) + circ(0, 0, 10.2, C.blue)
        + `<path d="M -9.8 2.2 Q 0 -6.5 9.8 -2.2" fill="none" stroke="${C.white}" stroke-width="2.4"/>`
        + star(-3.5, 4.5, 1.6, C.white) + star(2.5, 5.5, 1.4, C.white) + star(0, 8, 1.3, C.white) + star(5.5, 2, 1.2, C.white)],
    ['PE', 'Pernambuco', () => rect(-26, -26, 52, 34, C.blue) + rect(-26, 8, 52, 18, C.white)
        + arc(0, 6, 15, C.red, 2.6) + arc(0, 6, 12.4, C.yellow, 2.6) + arc(0, 6, 9.8, '#0b9a45', 2.6)
        + circ(0, 4.5, 4, C.yellow) + star(0, -17, 4.8, C.yellow)
        + rect(-1.6, 10, 3.2, 11.5, C.red) + rect(-5, 12.8, 10, 2.8, C.red)],
    ['PI', 'Piauí', () => hStripes([C.green, C.yellow, C.green, C.yellow, C.green, C.yellow])
        + rect(-26, -26, 24, 25, C.blue) + star(-11, -13, 5.2, C.white) + rect(-17, -4.6, 12, 1.3, C.white)],
    ['RJ', 'Rio de Janeiro', () => rect(-26, -26, 26, 26, C.white) + rect(0, -26, 26, 26, C.sky)
        + rect(-26, 0, 26, 26, C.sky) + rect(0, 0, 26, 26, C.white)
        + circ(0, 0, 9.2, C.yellow) + circ(0, 0, 7, C.sky) + star(0, 0.3, 4.6, C.white)],
    ['RN', 'Rio Grande do Norte', () => rect(-26, -26, 52, 26, C.white) + rect(-26, 0, 52, 26, '#0b7d3a')
        + circ(0, 0, 9.5, C.white, `stroke="${C.yellow}" stroke-width="1.6"`)
        + rect(-6.5, 0.5, 13, 5, C.sky) + star(0, -4, 3.2, C.yellow)],
    ['RS', 'Rio Grande do Sul', () => field('#0b7d3a') + poly([[26, -26], [26, 26], [-26, 26]], C.yellow)
        + bandUp(13, C.red) + circ(0, 0, 7.6, C.white, `stroke="#0b7d3a" stroke-width="1.3"`) + circ(0, 0, 4, C.yellow)],
    ['RO', 'Rondônia', () => rect(-26, -26, 52, 26, C.sky) + rect(-26, 0, 52, 26, '#0b7d3a')
        + poly([[-26, 0], [26, 0], [0, 26]], C.yellow) + star(0, -11.5, 7.2, C.white)],
    ['RR', 'Roraima', () => field('#0b7d3a') + poly([[-26, -26], [26, -26], [-26, 26]], C.sky)
        + bandUp(6, C.white) + star(0, 0, 6.8, C.yellow) + rect(-26, 20, 52, 6, C.red)],
    ['SC', 'Santa Catarina', () => hStripes([C.red, C.white, C.red])
        + poly([[-21, 0], [0, -14], [21, 0], [0, 14]], '#0b7d3a') + star(0, 0.4, 5.4, C.white)],
    ['SP', 'São Paulo', () => hStripes(Array.from({ length: 13 }, (_, i) => (i % 2 ? C.white : C.black)))
        + rect(-26, -26, 27, 24.1, C.red) + circ(-10.5, -11, 7, C.white)
        + poly([[-15, -19.5], [-10, -19.8], [-6.6, -16], [-6.7, -12.8], [-9.2, -9], [-11.2, -7.6], [-13, -9.2], [-15.6, -10.2], [-17.2, -13], [-18, -16.2]]
            .map(([x, y]) => [-10.5 + (x + 12.3) * 0.82, -11 + (y + 13.7) * 0.82]), C.blue)
        + [[-20.5, -6], [-6, -20.5], [-2.5, -4.5], [-16, -16]].map(([x, y]) => star(x, y, 1.6, C.yellow)).join('')],
    ['SE', 'Sergipe', () => hStripes([C.green, C.yellow, C.green, C.yellow]) + rect(-26, -26, 26, 26, C.blue)
        + star(-11, -18.5, 2.3, C.white) + star(-17, -12, 2, C.white) + star(-5, -12, 2, C.white)
        + star(-11, -5, 2.6, C.white) + star(-8.5, -9, 1.3, C.white)],
    ['TO', 'Tocantins', () => field(C.white) + poly([[-26, -26], [12, -26], [-26, 12]], C.sky)
        + poly([[26, -12], [26, 26], [-12, 26]], C.yellow)
        + Array.from({ length: 8 }, (_, i) => `<g transform="rotate(${i * 45})">${poly([[0, -9.5], [-1.6, -5.6], [1.6, -5.6]], C.yellow)}</g>`).join('')
        + circ(0, 0, 4.6, C.yellow)],
];

// Medalhao igual aos pins de pais (icons/505): 52x52, origem 26.25,
// bandeira recortada no circulo, sombra radial nas bordas e aro escuro.
function pinSvg(draw) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="52px" height="52px" viewBox="0 0 52 52">
  <defs>
    <clipPath id="disc"><circle cx="0" cy="0" r="24.7"/></clipPath>
    <radialGradient id="shade" cx="-4.8" cy="-6.3" r="31" gradientUnits="userSpaceOnUse">
      <stop offset="0.655" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <g transform="translate(26.25 26.25)">
    <g clip-path="url(#disc)">${draw()}</g>
    <circle r="24.7" fill="url(#shade)"/>
    <circle r="24.6" fill="none" stroke="#141414" stroke-width="2"/>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------- fonte TTF
function parseTTF(buf) {
    const tables = {};
    const n = buf.readUInt16BE(4);
    for (let i = 0; i < n; i++) {
        const r = 12 + i * 16;
        tables[buf.toString('latin1', r, r + 4)] = buf.readUInt32BE(r + 8);
    }
    const head = tables.head, maxp = tables.maxp, hhea = tables.hhea;
    const unitsPerEm = buf.readUInt16BE(head + 18);
    const locFmt = buf.readInt16BE(head + 50);
    const numGlyphs = buf.readUInt16BE(maxp + 4);
    const nHM = buf.readUInt16BE(hhea + 34);
    const loca = [];
    for (let i = 0; i <= numGlyphs; i++) {
        loca.push(locFmt ? buf.readUInt32BE(tables.loca + i * 4) : buf.readUInt16BE(tables.loca + i * 2) * 2);
    }
    const advance = (g) => buf.readUInt16BE(tables.hmtx + 4 * Math.min(g, nHM - 1));
    // cmap formato 4
    const cmap = new Map();
    const co = tables.cmap, nt = buf.readUInt16BE(co + 2);
    for (let i = 0; i < nt; i++) {
        const t = co + buf.readUInt32BE(co + 8 + i * 8);
        if (buf.readUInt16BE(t) !== 4) continue;
        const segX2 = buf.readUInt16BE(t + 6), seg = segX2 / 2;
        const ends = t + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ros = deltas + segX2;
        for (let s = 0; s < seg; s++) {
            const en = buf.readUInt16BE(ends + s * 2), st = buf.readUInt16BE(starts + s * 2);
            const d = buf.readInt16BE(deltas + s * 2), ro = buf.readUInt16BE(ros + s * 2);
            for (let c = st; c <= en && c !== 0xffff; c++) {
                let g;
                if (ro === 0) g = (c + d) & 0xffff;
                else { g = buf.readUInt16BE(ros + s * 2 + ro + (c - st) * 2); if (g) g = (g + d) & 0xffff; }
                if (g) cmap.set(c, g);
            }
        }
    }
    // glyf simples (fontes do SWF nao usam glifos compostos)
    function glyph(g) {
        const off = tables.glyf + loca[g];
        if (loca[g] === loca[g + 1]) return { contours: [], xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
        const nc = buf.readInt16BE(off);
        if (nc < 0) throw new Error(`glifo composto ${g} nao suportado`);
        const box = { xMin: buf.readInt16BE(off + 2), yMin: buf.readInt16BE(off + 4), xMax: buf.readInt16BE(off + 6), yMax: buf.readInt16BE(off + 8) };
        let p = off + 10;
        const endPts = [];
        for (let i = 0; i < nc; i++) { endPts.push(buf.readUInt16BE(p)); p += 2; }
        const nPts = nc ? endPts[nc - 1] + 1 : 0;
        p += 2 + buf.readUInt16BE(p); // instrucoes
        const flags = [];
        while (flags.length < nPts) {
            const fl = buf[p++];
            flags.push(fl);
            if (fl & 8) { let rep = buf[p++]; while (rep--) flags.push(fl); }
        }
        const xs = [], ys = [];
        let v = 0;
        for (const fl of flags) {
            if (fl & 2) { const d = buf[p++]; v += fl & 16 ? d : -d; }
            else if (!(fl & 16)) { v += buf.readInt16BE(p); p += 2; }
            xs.push(v);
        }
        v = 0;
        for (const fl of flags) {
            if (fl & 4) { const d = buf[p++]; v += fl & 32 ? d : -d; }
            else if (!(fl & 32)) { v += buf.readInt16BE(p); p += 2; }
            ys.push(v);
        }
        const contours = [];
        let s0 = 0;
        for (const e of endPts) {
            const pts = [];
            for (let i = s0; i <= e; i++) pts.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
            contours.push(pts);
            s0 = e + 1;
        }
        return { contours, ...box };
    }
    return { unitsPerEm, cmap, advance, glyph };
}

// contorno TrueType (quadratico, pontos on/off) -> path SVG
function contourPath(pts, X, Y) {
    if (!pts.length) return '';
    const n = pts.length;
    let start = pts.findIndex((q) => q.on);
    let first;
    if (start < 0) { first = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; start = 0; }
    else first = pts[start];
    let d = `M${f(X(first.x))} ${f(Y(first.y))}`;
    let ctrl = null;
    for (let k = 1; k <= n; k++) {
        const q = pts[(start + k) % n];
        if (q.on) {
            d += ctrl ? `Q${f(X(ctrl.x))} ${f(Y(ctrl.y))} ${f(X(q.x))} ${f(Y(q.y))}` : `L${f(X(q.x))} ${f(Y(q.y))}`;
            ctrl = null;
        } else {
            if (ctrl) {
                const mx = (ctrl.x + q.x) / 2, my = (ctrl.y + q.y) / 2;
                d += `Q${f(X(ctrl.x))} ${f(Y(ctrl.y))} ${f(X(mx))} ${f(Y(my))}`;
            }
            ctrl = q;
        }
    }
    if (ctrl) d += `Q${f(X(ctrl.x))} ${f(Y(ctrl.y))} ${f(X(first.x))} ${f(Y(first.y))}`;
    return d + 'Z';
}

const ACCENTS = { 'á': ['a', 'acute'], 'ã': ['a', 'tilde'], 'í': ['i', 'acute'], 'ô': ['o', 'circ'], 'é': ['e', 'acute'], 'ê': ['e', 'circ'], 'ó': ['o', 'acute'], 'ú': ['u', 'acute'], 'õ': ['o', 'tilde'], 'â': ['a', 'circ'] };

// acentos em unidades da fonte (y para cima), centrados em cx sobre by
function accentPath(kind, cx, by, u, X, Y) {
    const P = (pts) => 'M' + pts.map(([x, y]) => `${f(X(x))} ${f(Y(y))}`).join('L') + 'Z';
    if (kind === 'acute') {
        return P([[cx - 0.07 * u, by], [cx + 0.03 * u, by], [cx + 0.15 * u, by + 0.2 * u], [cx + 0.03 * u, by + 0.2 * u]]);
    }
    if (kind === 'circ') {
        return P([[cx - 0.18 * u, by], [cx - 0.07 * u, by], [cx, by + 0.09 * u], [cx + 0.07 * u, by], [cx + 0.18 * u, by], [cx + 0.05 * u, by + 0.19 * u], [cx - 0.05 * u, by + 0.19 * u]]);
    }
    // tilde: onda com espessura constante
    const w = 0.36 * u, amp = 0.045 * u, th = 0.075 * u, steps = 14;
    const top = [], bot = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = cx - w / 2 + w * t;
        const y = by + 0.07 * u + amp * Math.sin(t * Math.PI * 2 - Math.PI / 2 + Math.PI);
        top.push([x, y + th / 2]); bot.push([x, y - th / 2]);
    }
    return P([...top, ...bot.reverse()]);
}

// rotulo branco (como os dos paises) — 1 ou 2 linhas centralizadas
function labelSvg(font, text, { px = 15, maxW = 78, lineH = 14.5 } = {}) {
    const s = px / font.unitsPerEm;
    const u = font.unitsPerEm;
    const widthOf = (str) => [...str].reduce((w, ch) => {
        const base = ACCENTS[ch]?.[0] ?? ch;
        const g = font.cmap.get(base.codePointAt(0));
        return w + (g ? font.advance(g) : 0.3 * u) * s;
    }, 0);
    let lines = [text];
    if (widthOf(text) > maxW && text.includes(' ')) {
        // quebra no espaco mais perto do meio
        const words = text.split(' ');
        let best = null;
        for (let i = 1; i < words.length; i++) {
            const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
            const score = Math.max(widthOf(a), widthOf(b));
            if (!best || score < best.score) best = { score, lines: [a, b] };
        }
        lines = best.lines;
    }
    const W = Math.ceil(Math.max(...lines.map(widthOf))) + 2;
    const H = Math.ceil(lines.length * lineH + 1.5);
    let d = '';
    lines.forEach((line, li) => {
        let pen = (W - widthOf(line)) / 2;
        const baseline = 11 + li * lineH;
        for (const ch of line) {
            const [base, acc] = ACCENTS[ch] || [ch, null];
            const gi = font.cmap.get(base.codePointAt(0));
            if (!gi) { pen += 0.3 * u * s; continue; }
            const g = font.glyph(gi);
            const px0 = pen;
            const X = (x) => px0 + x * s, Y = (y) => baseline - y * s;
            let contours = g.contours;
            let top = g.yMax;
            if (base === 'i' && acc && contours.length > 1) {
                // i sem pingo: descarta o contorno mais alto (o pingo)
                const lows = contours.map((c) => Math.min(...c.map((q) => q.y)));
                const dot = lows.indexOf(Math.max(...lows));
                contours = contours.filter((_, k) => k !== dot);
                top = Math.max(...contours.flat().map((q) => q.y));
            }
            for (const c of contours) d += contourPath(c, X, Y);
            if (acc) d += accentPath(acc, (g.xMin + g.xMax) / 2, top + 0.06 * u, u, X, Y);
            pen += font.advance(gi) * s;
        }
    });
    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}px" height="${H}px" viewBox="0 0 ${W} ${H}">
  <path d="${d}" fill="#ffffff" fill-rule="nonzero"/>
</svg>
`;
    return { svg, W, H };
}

// ---------------------------------------------------------------- utilitarios
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha8 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);

function readCharSvg(tl, file) {
    const pe = tl.pack?.entries?.[file];
    if (pe) return readFileSync(join(CAT, 'chars', tl.pack.file)).subarray(pe[0], pe[0] + pe[1]).toString();
    const e = tl.chunks.entries[file];
    const chunk = e.length === 3 ? tl.chunks.files[e[0]] : tl.chunks.files[0];
    const [off, len] = e.length === 3 ? [e[1], e[2]] : e;
    return readFileSync(join(CAT, 'chars', chunk)).subarray(off, off + len).toString();
}

const mul = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const M = (m = [1, 0, 0, 1, 0, 0]) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });

// bounds em coords do book (mesma regra do movie.js: shape = size/origin)
function boundsOf(tl, entries, world) {
    let b = null;
    for (const e of entries) {
        const w = mul(world, M(e.matrix));
        const ch = tl.characters[e.id];
        let eb = null;
        if (tl.sprites[e.id]) eb = boundsOf(tl, tl.sprites[e.id].frames[0] || [], w);
        else if (ch?.file) {
            const [sw, sh] = ch.size || [0, 0], [ox, oy] = ch.origin || [0, 0];
            const pts = [[-ox, -oy], [sw - ox, -oy], [-ox, sh - oy], [sw - ox, sh - oy]]
                .map(([x, y]) => [w.a * x + w.c * y + w.x, w.b * x + w.d * y + w.y]);
            eb = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])),
                Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
        }
        if (eb) b = b ? [Math.min(b[0], eb[0]), Math.min(b[1], eb[1]), Math.max(b[2], eb[2]), Math.max(b[3], eb[3])] : eb;
    }
    return b;
}

// ---------------------------------------------------------------- main
const font = parseTTF(readFileSync(join(CAT, 'chars', 'font_469.ttf')));
const tl = readJson(join(CAT, 'timelines.json'));
const states = STATES.map(([uf, name, draw], i) => ({ uf, name, draw, id: FIRST_ID + i }));

// 1) itens
const itemsPath = join(assets, 'items.json');
const ids = new Set(states.map((s) => s.id));
const items = readJson(itemsPath).filter((it) => !ids.has(it.id));
for (const s of states) items.push({ id: s.id, name: s.name, type: 8, cost: COST });
items.sort((a, b) => a.id - b.id);
writeFileSync(itemsPath, JSON.stringify(items));

// 2) icones (inventario/player card) — mesma estrutura do icons/500
const iconTpl = readJson(join(assets, 'icons', '500', 'timelines.json'));
for (const s of states) {
    const dir = join(assets, 'icons', String(s.id));
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 'chars'), { recursive: true });
    const svg = Buffer.from(pinSvg(s.draw));
    writeFileSync(join(dir, 'chars', 'chars.pack'), svg);
    const t = structuredClone(iconTpl);
    t.source = sha8(svg);
    t.exports = { 2: `icon${s.id}` };
    t.characters = { 1: { kind: 'shape', file: '1.svg', size: [52, 52], origin: [26.25, 26.25] } };
    t.pack = { file: 'chars.pack', entries: { '1.svg': [0, svg.length] } };
    delete t.chunks;
    writeFileSync(join(dir, 'timelines.json'), JSON.stringify(t));
}
const idxPath = join(assets, 'icons', 'index.json');
const idx = new Set(readJson(idxPath));
for (const s of states) idx.add(s.id);
writeFileSync(idxPath, JSON.stringify([...idx].sort((a, b) => a - b)));

// 3) variante do catalogo
const v = structuredClone(tl);
const REL = '../../clothing/chars/';
if (v.pack?.file) v.pack.file = REL + v.pack.file;
v.chunks.files = v.chunks.files.map((x) => REL + x);
for (const fm of Object.values(v.fonts || {})) if (fm.file) fm.file = REL + fm.file;

const isFlagBtn = (id) => /buyInventory\(5[0-4]\d\)/.test(tl.buttonActions?.[id]?.release || '');
const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const slots = [];
for (const page of FLAG_PAGES) {
    const frame = v.main.frames[page - 1];
    const btns = frame.filter((e) => isFlagBtn(e.id));
    const sprites = frame.filter((e) => v.sprites[e.id] && !isFlagBtn(e.id));
    const texts = frame.filter((e) => v.characters[e.id]?.kind === 'text');
    const pageSlots = [];
    for (const btn of btns) {
        const [bx, by] = [btn.matrix[4], btn.matrix[5]];
        let sp = null, best = 1e9;
        for (const e of sprites) {
            const b = boundsOf(v, [e], M());
            if (!b) continue;
            const [cx, cy] = center(b);
            const dd = Math.hypot(cx - bx, cy - by);
            if (dd < best) { best = dd; sp = { e, cx, cy }; }
        }
        if (!sp || best > 12) throw new Error(`pagina ${page}: botao ${btn.id} sem pin proximo`);
        let lb = null; best = 1e9;
        for (const e of texts) {
            const b = boundsOf(v, [e], M());
            const [cx] = center(b);
            const dy = b[1] - sp.cy;
            if (dy < 10 || dy > 40 || Math.abs(cx - sp.cx) > 30) continue;
            const dd = Math.abs(cx - sp.cx) + dy;
            if (dd < best) { best = dd; lb = { e, top: b[1] }; }
        }
        if (!lb) throw new Error(`pagina ${page}: pin ${sp.e.id} sem rotulo`);
        pageSlots.push({ page, btn, sp, lb });
    }
    // ordem de leitura: pagina esquerda (linhas) e depois a direita
    pageSlots.sort((a, b) => ((a.sp.cx > 380) - (b.sp.cx > 380))
        || (Math.round(a.sp.cy / 20) - Math.round(b.sp.cy / 20)) || (a.sp.cx - b.sp.cx));
    slots.push(...pageSlots);
}
if (new Set(slots.map((s) => s.btn.id)).size !== slots.length) throw new Error('botao reaproveitado entre slots');
console.log(`slots de bandeira: ${slots.length} (estados: ${states.length})`);

// ids novos acima de qualquer id existente
let nextId = Math.max(...Object.keys(v.characters).map(Number), ...Object.keys(v.sprites).map(Number)) + 1;
const glint = tl.sprites[String(slots[0].sp.e.id)]?.frames?.[0]?.find((e) => e.id === 162);
const newFiles = [];
const removeFromPage = new Map(); // page -> Set(entry objects)
slots.forEach((slot, i) => {
    const frame = v.main.frames[slot.page - 1];
    const s = states[i];
    if (!s) {
        const rm = removeFromPage.get(slot.page) || new Set();
        rm.add(slot.btn); rm.add(slot.sp.e); rm.add(slot.lb.e);
        removeFromPage.set(slot.page, rm);
        return;
    }
    // pin: shape + brilho (162) como os sprites 'flag' originais
    const pinFile = `br_${s.uf}.svg`;
    const pinId = nextId++, spriteId = nextId++, labelId = nextId++;
    newFiles.push([pinFile, Buffer.from(pinSvg(s.draw))]);
    v.characters[pinId] = { kind: 'shape', file: pinFile, size: [52, 52], origin: [26.25, 26.25] };
    v.sprites[spriteId] = {
        frames: [[{ depth: 2, id: pinId, matrix: [1, 0, 0, 1, 0, 0] },
            ...(glint ? [structuredClone(glint)] : [])]],
        labels: {}, scriptFrames: [], sounds: [],
    };
    const k = 0.8;
    const spEntry = frame.find((e) => e === slot.sp.e);
    Object.assign(spEntry, { id: spriteId, matrix: [k, 0, 0, k, f(slot.sp.cx + 0.25 * k), f(slot.sp.cy + 0.25 * k)], name: 'flag' });
    // rotulo
    const lab = labelSvg(font, s.name);
    const labFile = `br_${s.uf}_label.svg`;
    newFiles.push([labFile, Buffer.from(lab.svg)]);
    v.characters[labelId] = { kind: 'text', file: labFile, size: [lab.W, lab.H], origin: [0, 0] };
    const lbEntry = frame.find((e) => e === slot.lb.e);
    Object.assign(lbEntry, { id: labelId, matrix: [k, 0, 0, k, f(slot.sp.cx - (k * lab.W) / 2), f(slot.lb.top)] });
    // compra
    v.buttonActions[slot.btn.id] = { ...(v.buttonActions[slot.btn.id] || {}), release: `on(release){\n   INTERFACE.buyInventory(${s.id});\n}\n` };
});
for (const [page, rm] of removeFromPage) {
    v.main.frames[page - 1] = v.main.frames[page - 1].filter((e) => !rm.has(e));
}

// chunk novo com os SVGs gerados (nome com hash = imutavel no cache)
let off = 0;
const parts = [];
const entries = {};
const chunkIdx = v.chunks.files.length;
for (const [file, buf] of newFiles) {
    entries[file] = [chunkIdx, off, buf.length];
    parts.push(buf);
    off += buf.length;
}
const chunk = Buffer.concat(parts);
const chunkName = `chunk-br-${sha8(chunk)}.pack`;
v.chunks.files.push(chunkName);
Object.assign(v.chunks.entries, entries);

rmSync(OUT_CAT, { recursive: true, force: true });
mkdirSync(join(OUT_CAT, 'chars'), { recursive: true });
writeFileSync(join(OUT_CAT, 'chars', chunkName), chunk);
writeFileSync(join(OUT_CAT, 'timelines.json'), JSON.stringify(v));

// folha de conferencia (abrir no navegador): todos os pins + rotulos
const sheet = states.map((s) => {
    const lab = labelSvg(font, s.name);
    return `<figure><img src="data:image/svg+xml;utf8,${encodeURIComponent(pinSvg(s.draw))}" width="132"><div class="l"><img src="data:image/svg+xml;utf8,${encodeURIComponent(lab.svg)}" width="${Math.round(lab.W * 1.4)}"></div><figcaption>${s.uf} · ${s.id}</figcaption></figure>`;
}).join('\n');
writeFileSync(join(OUT_CAT, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Pins estados BR</title>
<style>body{background:#1b4f9c;font:12px Arial;color:#cfe;display:flex;flex-wrap:wrap;gap:8px;padding:10px}figure{margin:0;width:136px;text-align:center}.l{min-height:40px}</style>
${sheet}`);

console.log(`itens ${FIRST_ID}..${FIRST_ID + states.length - 1}, icones, catalogo clothing-br (${chunkName}, ${chunk.length} bytes)`);
console.log(`conferencia: client/public/assets/catalogues/clothing-br/preview.html`);
