// Tooltip.js — "hint" do CP original: hint_mc (sprite 792) do pack
// interface — caixa arredondada (shape 789) + message_txt centralizado
// (font 190/Arial 12). O CP usa esse componente para dicas de UI; aqui
// vira tooltip de hover.
// A caixa e composta manualmente (stretch horizontal do bitmap + texto
// canvas) em vez de _drawEntries: o nine-slice do renderer abria um gap
// de ~1px nas emendas e o message_txt ficava ~1px abaixo do centro.
// Renderiza sob demanda para canvas -> textura Phaser, dentro do container
// pai (herda posicao/escala do card).
import { MovieRoom } from '../movie/movie.js';

const SPRITE_ID = '792';   // hint_mc = { box_mc (sprite 790 -> shape 789), message_txt }
const BOX_FILE = '789.svg';
const BOX_CHAR = '789';
const BOX_W = 88;          // tamanho base do shape 789 antes do stretch
const BOX_H = 22;
const BOX_CY = 1;          // centro visual da caixa no espaco do hint (y -10..12)
const RENDER_SCALE = 3;
const PAD = 6;
const GAP = 5;
const TEXT_PAD = 20;       // respiro lateral dentro da caixa

let _moviePromise = null;
function interfaceMovie() {
    if (!_moviePromise) {
        _moviePromise = MovieRoom.load('/assets/movies/interface')
            .then((m) => { m.setScale(1); return m; })
            .catch((e) => { console.warn('[tooltip] interface load', e); _moviePromise = null; return null; });
    }
    return _moviePromise;
}

// cache de texturas por texto — o hint e estatico por conteudo
const _texCache = new Map();

export class UiTooltip {
    // parent: container Phaser onde o tooltip sera adicionado (coords locais)
    constructor(scene, parent) {
        this.scene = scene;
        this.parent = parent;
        this.image = null;
        this._seq = 0;
    }

    // x,y,w,h: bounds do elemento âncora em coords locais do parent.
    // Mostra a hint acima do elemento (inverte se nao houver espaco).
    async show(x, y, w, h, text) {
        const token = ++this._seq;
        const tex = await this._render(text);
        if (!tex || token !== this._seq || !this.parent?.scene) return;
        const bx = x + w / 2;
        const flip = y - GAP - tex.h < 0;
        const by = flip ? y + h + GAP : y - GAP;
        if (this.image) this.image.destroy();
        this.image = this.scene.add.image(bx, by, tex.key)
            .setOrigin(0.5, flip ? 0 : 1)
            .setDisplaySize(tex.w, tex.h);
        this.parent.add(this.image);
    }

    hide() {
        this._seq++;
        if (this.image) { this.image.destroy(); this.image = null; }
    }

    async _render(text) {
        if (_texCache.has(text)) return _texCache.get(text);
        const movie = await interfaceMovie();
        const ch = movie?.characters?.[BOX_CHAR];
        if (!movie || !ch) return null;
        await movie.ensureFonts();
        // largura da caixa = texto (font 190/size 12 do message_txt) + respiro
        const fam = await movie._fontFamily(190);
        const mc = document.createElement('canvas').getContext('2d');
        mc.font = `12px ${fam}, sans-serif`;
        const boxW = Math.ceil(mc.measureText(text).width) + TEXT_PAD;
        const k = Math.max(0.6, boxW / BOX_W);
        // rasteriza a caixa na escala efetiva do stretch horizontal
        const boxBmp = await movie.artCanvas(BOX_FILE, ch, RENDER_SCALE * Math.max(k, 1));
        if (!boxBmp) return null;
        const w = Math.ceil(boxW) + PAD * 2;
        const h = BOX_H + PAD * 2;
        const canvas = document.createElement('canvas');
        canvas.width = w * RENDER_SCALE;
        canvas.height = h * RENDER_SCALE;
        const ctx = canvas.getContext('2d');
        // origem do desenho: centro-x da caixa, topo da caixa (y=-10 no
        // espaco do shape 789, que tem origin [44,10] -> bounds -44..44 x,
        // -10..12 y)
        ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE,
            (PAD + boxW / 2) * RENDER_SCALE, (PAD + 10) * RENDER_SCALE);
        ctx.drawImage(boxBmp, -boxW / 2, -10, boxW, BOX_H);
        ctx.font = `12px ${fam}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(text, 0, BOX_CY);
        const texKey = `uihint_${text.replace(/[^\w]/g, '_')}`;
        if (!this.scene.textures.exists(texKey)) this.scene.textures.addCanvas(texKey, canvas);
        const rec = { key: texKey, w, h };
        _texCache.set(text, rec);
        return rec;
    }
}
