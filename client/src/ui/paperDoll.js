// paperDoll.js — renderiza o pinguim de frente (paper_doll_mc do interface.swf)
// num canvas: corpo com a cor do jogador + outline + roupas clothing/paper/<id>
// na ordem feet->body->neck->face->head->hand. Compartilhado por PlayerCard
// e Wardrobe.
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { veColor } from '../entities/PenguinArt.js';
import { DEFAULT_COLOR_RGB } from '../items/colors.js';

const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
export const PAPER_ORDER = ['feet', 'body', 'neck', 'face', 'head', 'hand'];

// cache de MovieRoom dos packs paper/<id> e icons/<id>
const _movies = new Map();
export function assetMovie(kind, id) {
    const key = `${kind}/${id}`;
    if (!_movies.has(key)) {
        _movies.set(key, MovieRoom.load(`/assets/${kind}/${id}`)
            .then((m) => { m.setScale(1); return m; })
            .catch((e) => { console.warn(`[paperdoll] ${kind}/${id}`, e); _movies.delete(key); return null; }));
    }
    return _movies.get(key);
}
// alias usado pelo PlayerCard (paperMovie(id) -> paper/<id>)
export const paperMovie = (id) => assetMovie('paper', id);

let _ifacePromise = null;
export function interfaceMovie(scene) {
    if (!_ifacePromise) {
        _ifacePromise = (scene?.game?._interfaceMoviePromise
            ? scene.game._interfaceMoviePromise
            : MovieRoom.load('/assets/movies/interface').then((m) => { m.setScale(1); return m; }))
            .catch((e) => { console.warn('[paperdoll] interface', e); return null; });
    }
    return _ifacePromise;
}

// Retorna {canvas, clip, entries, dollWorld, bodyE, outlineE} prontos para
// desenhar o doll; ou null se o pack falhar.
export async function dollParts(scene) {
    const movie = await interfaceMovie(scene);
    if (!movie) return null;
    const clip = new Clip(movie);
    const sp = movie.sprites['701'];
    const entries = sp?.frames?.[1];
    if (!entries) return null;
    const dollEntry = entries.find((e) => e.name === 'paper_doll_mc');
    const dollFrame = dollEntry && movie.sprites[String(dollEntry.id)]?.frames?.[0];
    if (!dollFrame) return null;
    const dm = dollEntry.matrix || [1, 0, 0, 1, 0, 0];
    const dollWorld = { a: dm[0], b: dm[1], c: dm[2], d: dm[3], x: dm[4], y: dm[5] };
    return {
        movie, clip, entries, dollWorld,
        bodyE: dollFrame.find((e) => e.name === 'body'),
        outlineE: dollFrame.find((e) => e.name === 'outline'),
    };
}

// Desenha o doll (corpo+outline+paper/<id>) num ctx com transform lógico
// ja aplicado (o caller decide o viewport). world=dollWorld mapeia coords do
// paper_doll_mc -> frame do sprite 701.
export async function drawDoll(ctx, parts, penguin, scale = 1) {
    const { clip, dollWorld, bodyE, outlineE } = parts;
    const look = penguin.gpaOutfit || {};
    const color = veColor(penguin.penguinColor || DEFAULT_COLOR_RGB);
    try {
        if (bodyE) await clip._drawListFrame(ctx, [bodyE], dollWorld, '', color, scale);
        if (outlineE) await clip._drawListFrame(ctx, [outlineE], dollWorld, '', IDENT_COLOR, scale);
        for (const slot of PAPER_ORDER) {
            const id = Number(look[slot]);
            if (!id) continue;
            const pm = await paperMovie(id);
            if (!pm) continue;
            const pclip = new Clip(pm);
            await pclip._drawListFrame(ctx, pm.data?.main?.frames?.[0] || [], dollWorld, '', IDENT_COLOR, scale);
        }
    } catch (e) { console.warn('[paperdoll] draw', e); }
}

// Renderiza o doll inteiro num canvas quadrado/retangular, centralizado,
// com margem — pronto para virar textura Phaser.
export async function renderDollCanvas(scene, penguin, w = 200, h = 240, margin = 14) {
    const parts = await dollParts(scene);
    if (!parts) return null;
    // bounds do conteudo do doll (body+outline) no espaco do sprite701
    const content = [parts.bodyE, parts.outlineE].filter(Boolean);
    let b = parts.clip._boundsOf(content, parts.dollWorld, '');
    if (!b) b = [60, 60, 160, 220];
    const bw = b[2] - b[0], bh = b[3] - b[1];
    const scale = Math.min((w - margin * 2) / bw, (h - margin * 2) / bh);
    const ox = (w - bw * scale) / 2 - b[0] * scale;
    const oy = (h - bh * scale) / 2 - b[1] * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    await drawDoll(ctx, parts, penguin, 2); // scale=2 = resolucao da arte
    return canvas;
}
