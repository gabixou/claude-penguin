// IglooGridview — port do client/gridview.swf (AS2) do wand.
// Browser de itens do editor de iglu: janela lightbox + grade de thumbs
// (thumb_box_mc 52x52, gap 6), colunas via chooseColumns, paginacao com
// scrollbar (up/down), contador de itens (show_count), hover e clique
// -> callback(id) + fecha. Slider de densidade nao portado (aproximacao).

import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { SS_FIXED, WORLD_W, WORLD_H } from '../display.js';
import { movieFrameTexture } from './IglooWidgets.js';

const PACK = '/assets/movies/gridview';
const THUMB_GAP = 6;
const MAX_THUMBS = 54;
const PADDING = 1.35;          // GV_DEFAULT_OPTIONS.padding_percent

let _movieP = null;
function gvMovie() {
    if (!_movieP) _movieP = MovieRoom.load(PACK).catch(() => null);
    return _movieP;
}

async function gvTex(scene, entries, key) {
    const movie = await gvMovie();
    if (!movie) return null;
    return movieFrameTexture(scene, movie, entries, key);
}

// bounds de um sprite (mesmo calculo do renderEntries)
async function spriteBounds(spriteId) {
    const movie = await gvMovie();
    const sp = movie?.sprites?.[String(spriteId)];
    const entries = sp?.frames?.[0];
    if (!entries) return null;
    const clip = new Clip(movie);
    return clip._boundsOf(entries, { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, '');
}

// chooseColumns do AS
function chooseColumns(count) {
    if (count === 3) return 3;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    if (count <= 12) return 4;
    if (count <= 16 || count <= 20) return 5;
    if (count <= 30) return 6;
    if (count <= 42) return 8;
    if (count <= 54) return 9;
    if (count <= 80) return 10;
    return 11;
}

export class IglooGridview {
    // items: [{id, name, count, disabled}] — count = quantidade possuida
    // onPick(id) chamado no clique; onClose ao fechar
    constructor(scene, { items = [], onPick, onClose, showCount = true, perPage, iconFor } = {}) {
        this.scene = scene;
        this.items = items;
        this.onPick = onPick;
        this.onClose = onClose;
        this.showCount = showCount;
        this.iconFor = iconFor || null; // (id) => Promise<tex|null> custom
        this.page = 0;
        this.perPage = perPage ?? Math.min(items.length || 1, MAX_THUMBS);
        this._objs = [];
        this.isOpen = false;
    }

    async open() {
        this.isOpen = true;
        const scene = this.scene;
        const movie = await gvMovie();
        if (!movie) { this.isOpen = false; return; }
        // lightbox_mc (sprite 24): dim + janela, stage inteiro 760x480
        const lb = await gvTex(scene, movie.sprites['24'].frames[0], 'gv_lightbox');
        if (lb) {
            this._lb = scene.add.image(0, 0, lb.key).setOrigin(0, 0)
                .setScale(1 / SS_FIXED).setDepth(500);
        }
        // close_btn (sprite 26) na posicao do stage (734.35, 22.1)
        const cb = movie.sprites['26']?.frames?.[0];
        if (cb) {
            const t = await gvTex(scene, cb, 'gv_close');
            if (t) {
                const b = await spriteBounds('26');
                // registro do botao: bounds x0/y0 relativos a (734.35,22.1)
                this._close = scene.add.image(734.35 + (b?.[0] ?? 0), 22.1 + (b?.[1] ?? 0), t.key)
                    .setOrigin(0, 0).setScale(1 / SS_FIXED).setDepth(501).setInteractive({ useHandCursor: true });
                // area clicavel: botao ~15x15 no registro
                this._close.setSize?.(30, 30);
                this._close.on('pointerup', () => this.close());
            }
        }
        // clicar no lightbox fora da janela tambem fecha (AS: lightbox_mc.onRelease)
        this._lb?.setInteractive();
        this._lb?.on('pointerup', (p) => {
            const wx = p.worldX ?? p.x, wy = p.worldY ?? p.y;
            if (wx < 90 || wx > 670 || wy < 40 || wy > 430) this.close();
        });
        // thumb_box chrome (sprite 18) — texto/badge sao Phaser.Text.
        // O frame inclui overlays de estado (hover_mc/available_mc) e o
        // blank_symbol_mc (o "X" de slot vazio) que o AS esconde via
        // blank_symbol_mc._visible=false — excluimos do render estatico.
        const HIDDEN_CELL = new Set(['hover_mc', 'available_mc', 'blank_symbol_mc']);
        const cellFrame = (movie.sprites['18'].frames[0] || [])
            .filter((en) => !HIDDEN_CELL.has(en.name));
        const cellB = await spriteBounds('18');
        this.cellW = cellB ? cellB[2] - cellB[0] : 52;
        this.cellH = cellB ? cellB[3] - cellB[1] : 52;
        this._cellTex = await gvTex(scene, cellFrame, 'gv_thumbbox');
        this._cellBounds = cellB;
        // scrollbar (sprite 6): up_btn/down_btn sao entries do frame 0
        const sb = movie.sprites['6']?.frames?.[0];
        if (sb) {
            this._sbTexP = gvTex(scene, sb, 'gv_scrollbar');
            this._sbEntries = sb;
            this._sbBounds = await spriteBounds('6');
        }
        this._movie = movie;
        this._iconCache = new Map();
        this._render();
    }

    _pageItems() {
        const start = this.page * this.perPage;
        return this.items.slice(start, start + this.perPage);
    }

    async _iconTex(itemId) {
        if (this.iconFor) {
            if (!this._iconCache.has(itemId)) this._iconCache.set(itemId, this.iconFor(itemId));
            return this._iconCache.get(itemId);
        }
        if (this._iconCache.has(itemId)) return this._iconCache.get(itemId);
        const p = (async () => {
            // icone dedicado do wand (furniture/icons/<id>.swf); fallback
            // p/ o sprite da mobília enquanto o pack de icon nao existe
            for (const pack of [
                `/assets/movies/furniture-icon/${itemId}`,
                `/assets/movies/furniture/${itemId}`,
            ]) {
                const m = await MovieRoom.load(pack).catch(() => null);
                if (!m) continue;
                const frame = m._mainTl?.frames?.[0] || [];
                const t = await movieFrameTexture(this.scene, m, frame, `gv_icon_${itemId}_${pack.includes('icon') ? 'i' : 'f'}`).catch(() => null);
                if (t) return t;
            }
            return null;
        })();
        this._iconCache.set(itemId, p);
        return p;
    }

    async _render() {
        this._objs.forEach((o) => o.destroy?.());
        this._objs = [];
        const scene = this.scene;
        const list = this._pageItems();
        const cols = chooseColumns(this.perPage);
        const rows = Math.ceil(this.perPage / cols) || 1;
        const gridW = cols * (this.cellW + THUMB_GAP) - THUMB_GAP;
        const gridH = rows * (this.cellH + THUMB_GAP) - THUMB_GAP;
        // centerToStage: x = 380 - w/2 ; y = 218 - h/2 + 14
        const hx = WORLD_W / 2 - gridW / 2;
        const hy = WORLD_H / 2 - gridH / 2 - 6 + 20;
        for (let i = 0; i < this.perPage; i++) {
            const it = list[i];
            const cx = hx + (i % cols) * (this.cellW + THUMB_GAP);
            const cy = hy + Math.floor(i / cols) * (this.cellH + THUMB_GAP);
            const cell = { id: it?.id, count: it?.count ?? 0, disabled: !!it?.disabled };
            // chrome da celula
            if (this._cellTex) {
                const b = this._cellBounds;
                const img = scene.add.image(cx + (b?.[0] ?? 0), cy + (b?.[1] ?? 0), this._cellTex.key)
                    .setOrigin(0, 0).setScale(1 / SS_FIXED).setDepth(502);
                this._objs.push(img);
            }
            const zone = scene.add.zone(cx + this.cellW / 2, cy + this.cellH / 2, this.cellW, this.cellH)
                .setOrigin(0.5).setDepth(503);
            this._objs.push(zone);
            if (!it) continue;
            const locked = cell.count === 0 || cell.disabled;
            // icone: art_mc fica no centro da celula (25,25 do thumb_box)
            const texP = this._iconTex(it.id);
            texP.then((t) => {
                if (!t || !this.isOpen) return;
                const maxDim = this.cellH / PADDING;
                const s = Math.min(maxDim / t.w, maxDim / t.h, 1);
                const icon = scene.add.image(cx + this.cellW / 2, cy + this.cellH / 2 - 2, t.key)
                    .setOrigin(0.5).setScale(s / SS_FIXED).setDepth(504)
                    .setAlpha(locked ? 0.5 : 1);
                this._objs.push(icon);
            });
            // contador (count_txt ~ canto sup-esq da celula)
            if (this.showCount) {
                const txt = scene.add.text(cx + 5, cy + 2, String(cell.count), {
                    fontFamily: 'Arial', fontSize: '11px', color: '#ffffff',
                    stroke: '#000000', strokeThickness: 2,
                }).setDepth(505);
                this._objs.push(txt);
            }
            if (!locked) {
                zone.setInteractive({ useHandCursor: true });
                zone.on('pointerover', () => zone.setAlpha(0.3));
                zone.on('pointerout', () => zone.setAlpha(0));
                zone.on('pointerup', () => { this.onPick?.(it.id); this.close(); });
            } else {
                zone.setAlpha(0.4);
            }
        }
        // scrollbar se lista > por pagina (attachScrollBar do AS)
        if (this.items.length > this.perPage && this._sbTexP) {
            const t = await this._sbTexP;
            const b = this._sbBounds;
            if (t && b && this.isOpen) {
                const sbW = b[2] - b[0], sbH = b[3] - b[1];
                const sx = hx + gridW + 20 + b[0];
                const sy = hy + gridH / 2 - sbH / 2 + b[1];
                const img = scene.add.image(sx, sy, t.key)
                    .setOrigin(0, 0).setScale(1 / SS_FIXED).setDepth(502);
                this._objs.push(img);
                // zonas up/down: posicao do entry dentro do sprite - bounds
                for (const [name, fn] of [
                    ['up_btn', () => { if (this.page > 0) { this.page--; this._render(); } }],
                    ['down_btn', () => {
                        const max = Math.ceil(this.items.length / this.perPage) - 1;
                        if (this.page < max) { this.page++; this._render(); }
                    }],
                ]) {
                    const e = this._sbEntries.find((en) => en.name === name);
                    if (!e) continue;
                    const zx = sx + (e.matrix[4] - b[0]);
                    const zy = sy + (e.matrix[5] - b[1]);
                    const z = scene.add.zone(zx, zy, 26, 26).setOrigin(0.5).setDepth(503)
                        .setInteractive({ useHandCursor: true });
                    z.on('pointerup', fn);
                    this._objs.push(z);
                }
            }
        }
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this._objs.forEach((o) => o.destroy?.());
        this._objs = [];
        this._lb?.destroy(); this._lb = null;
        this._close?.destroy(); this._close = null;
        this.onClose?.();
    }

    destroy() { this.close(); }
}
