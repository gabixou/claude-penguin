// IglooWidgets — renderiza os componentes reais do igloo.swf do wand
// (iglooRoom buttons, iglooEditor topBar/sideBar/tabPane) como texturas
// Phaser + botoes com estados up/over/down, para a UI do iglu ficar
// identica ao Club Penguin original.

import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { SS_FIXED } from '../display.js';

let _movieP = null;
export function iglooWndMovie() {
    if (!_movieP) _movieP = MovieRoom.load('/assets/movies/igloo-wand').catch(() => null);
    return _movieP;
}

const _clip = () => new Clip(null); // placeholder — clip real por chamada

// Renderiza entries de display list num canvas e registra textura.
// entries: frame de sprite OU records.up de um botao.
async function renderEntries(scene, movie, entries, key, scale = SS_FIXED, clip = null) {
    clip = clip || new Clip(movie);
    const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    const COL = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
    const b = clip._boundsOf(entries, ID, '') || [0, 0, 100, 100];
    const pad = 6;
    const x0 = Math.floor(b[0] - pad), y0 = Math.floor(b[1] - pad);
    const w = Math.max(1, Math.ceil(b[2] - b[0] + pad * 2));
    const h = Math.max(1, Math.ceil(b[3] - b[1] + pad * 2));
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * scale); cv.height = Math.ceil(h * scale);
    const ctx = cv.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    await clip._drawListFrame(ctx, entries, ID, '', COL, scale * 2);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, cv);
    return { key, w, h, x0, y0 };
}

// Textura do frame N de um sprite do igloo-wand (ex.: '206' tabPane).
export async function iglooSpriteTex(scene, spriteId, frame = 0, key) {
    const movie = await iglooWndMovie();
    if (!movie) return null;
    const sp = movie.sprites?.[String(spriteId)];
    if (!sp?.frames?.length) return null;
    const k = key || `igw_sp_${spriteId}_${frame}`;
    return renderEntries(scene, movie, sp.frames[frame] || sp.frames[0], k);
}

// Texturas up/over/down de um botao (character kind 'button' -> records).
export async function iglooButtonTex(scene, charId, key) {
    const movie = await iglooWndMovie();
    if (!movie) return null;
    const ch = movie.characters?.[String(charId)];
    if (!ch?.records) return null;
    const base = key || `igw_btn_${charId}`;
    const up = await renderEntries(scene, movie, ch.records.up || [], `${base}_up`);
    const over = ch.records.over
        ? await renderEntries(scene, movie, ch.records.over, `${base}_over`)
        : up;
    const down = ch.records.down
        ? await renderEntries(scene, movie, ch.records.down, `${base}_down`)
        : over;
    return { up, over, down };
}

// Botao Phaser com os 3 estados do SWF. cb recebe o ponteiro.
export async function iglooButton(scene, x, y, charId, { key, scale = 1, onClick, visible = true } = {}) {
    const tex = await iglooButtonTex(scene, charId, key);
    if (!tex) return null;
    const img = scene.add.image(x, y, tex.up.key)
        .setOrigin(0.5, 0.5)
        // a textura e rasterizada em SS_FIXED (2.25x) — sem dividir pelo
        // mesmo fator o botao aparece ~2.25x maior que o original
        .setScale((scale || 1) / SS_FIXED)
        .setVisible(visible).setDepth(60);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerover', () => img.setTexture(tex.over.key));
    img.on('pointerout', () => img.setTexture(tex.up.key));
    img.on('pointerdown', () => img.setTexture(tex.down.key));
    img.on('pointerup', () => { img.setTexture(tex.up.key); onClick?.(); });
    img._iglooTex = tex;
    return img;
}

// Zona clicavel invisavel sobre uma regiao (para tabs/areas do topBar).
export function iglooZone(scene, x, y, w, h, onClick) {
    const z = scene.add.zone(x, y, w, h).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(61);
    z.on('pointerover', () => { z.setAlpha(0.25); });
    z.on('pointerout', () => { z.setAlpha(0); });
    z.on('pointerup', onClick);
    return z;
}

// ===== Movies (AS2 legado) =====
let _as2P = null;
export function iglooAs2Movie() {
    if (!_as2P) _as2P = MovieRoom.load('/assets/movies/igloo-as2').catch(() => null);
    return _as2P;
}

// Renderiza um frame de display list qualquer (ex.: frame 0 de um pack
// de mobília) recortado nos bounds da arte — para itens cujo palco SWF
// é maior que o desenho (furniture: stage 550x400, arte ~60x73 centrada
// em coords negativas).
export async function movieFrameTexture(scene, movie, entries, key, scale = SS_FIXED, clip = null) {
    return renderEntries(scene, movie, entries, key, scale, clip);
}

// ===== AS2 (igloo.swf legado) =====
// No SWF AS2 os "botoes" sao sprites DefineButton2 convertidos em
// sprites de 2 frames: frame 0 = up, frame 1 = over (hoverBTN faz
// gotoAndStop(2)). Renderizamos os dois frames como texturas e trocamos
// no hover, como no original.

async function as2FrameTex(scene, movie, spriteId, frame, key, exclude) {
    const sp = movie.sprites?.[String(spriteId)];
    let entries = sp?.frames?.[frame] || sp?.frames?.[0];
    if (!entries?.length) return null;
    // clips auxiliares do SWF (hit_area_mc fullscreen transparente,
    // loading_mc spinner) nao devem ser rasterizados — no AS2 ficam
    // _alpha=0/_visible=false. `exclude` filtra por e.name.
    if (exclude?.length)
        entries = entries.filter((e) => !exclude.includes(e.name));
    if (!entries.length) return null;
    return renderEntries(scene, movie, entries, key);
}

// Sprite estatico do igloo-as2 (1 frame) como imagem Phaser.
// x,y = posicao do REGISTRO (0,0) do sprite no stage — a textura e
// recortada nos bounds, entao compensamos o offset x0/y0 para o arte
// cair exatamente onde o SWF colocava.
export async function as2Sprite(scene, spriteId, x, y, { key, frame = 0, scale = 1, depth = 55, flipX = false, exclude } = {}) {
    const movie = await iglooAs2Movie();
    if (!movie) return null;
    const k = key || ('ig2_sp_' + spriteId + '_' + frame);
    const t = await as2FrameTex(scene, movie, spriteId, frame, k, exclude);
    if (!t) return null;
    const img = scene.add.image(x + t.x0, y + t.y0, t.key)
        .setOrigin(0, 0).setScale((scale || 1) / SS_FIXED).setDepth(depth);
    if (flipX) img.setFlipX(true);
    return { img, tex: t };
}

// Botao AS2: sprite com frame0=up / frame1=over.
export async function as2Button(scene, spriteId, x, y, { key, onClick, flipX = false, depth = 60 } = {}) {
    const movie = await iglooAs2Movie();
    if (!movie) return null;
    const base = key || ('ig2_btn_' + spriteId);
    const up = await as2FrameTex(scene, movie, spriteId, 0, base + '_up');
    if (!up) return null;
    const over = await as2FrameTex(scene, movie, spriteId, 1, base + '_over');
    const t = over || up;
    const img = scene.add.image(x + t.x0, y + t.y0, up.key)
        .setOrigin(0, 0).setScale(1 / SS_FIXED).setDepth(depth);
    if (flipX) img.setFlipX(true);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerover', () => { if (over) img.setTexture(over.key); });
    img.on('pointerout', () => img.setTexture(up.key));
    img.on('pointerup', () => onClick?.());
    img._as2Tex = { up, over };
    return img;
}
