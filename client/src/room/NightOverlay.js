// Ciclo dia/noite — Fase 1.5 (exploracao na branch dev3).
// Overlay global de "noite": multiply azul + veu escuro + estrelas/lua.
//
// Fase 1.5: estrelas/lua NAO flutuam sobre a sala — uma mascara por sala e
// gerada varrendo o canvas do backdrop (maior segmento): pixel "azul de ceu"
// fica branco, o resto transparente. O compositing destination-in corta a
// textura de ceu exatamente onde ha construcao/chao — a lua "passa atras"
// do gift shop como num jogo de verdade. Mascara cacheada por sala+SS.
//
// Camadas (todas depth 8M, abaixo do HUD 10M):
//   tint  — multiply azul (escurece e joga o ciano do crepusculo)
//   veil  — preto normal, alpha=f² (profundidade extra de madrugada)
//   sky   — estrelas+lua mascaradas (por cima do veil: estrelas ficam vivas)
//
// Horario: America/Sao_Paulo fixo em UTC-3. QA: ?tod=22.5, ?night=0.
import Phaser from 'phaser';

// Salas EXTERNAS (ceu visivel). Whitelist facil de ajustar — internas
// (coffee, dance, pizza, dojo, shop, book, boiler, lounge, pet, stage,
// attic, dojoext, cavemine, cave, igloo) ficam sempre "de dia".
export const NIGHT_ROOMS = new Set([
    'town', 'plaza', 'beach', 'dock', 'forts', 'forest', 'light',
    'ship', 'village', 'mtn', 'cove', 'shack', 'berg', 'lodge',
    'mine', 'rink',
]);

// Curva dia/noite: [hora SP, fator 0=dia .. 1=noite fechada], linear entre pontos.
const CURVE = [
    [0, 1], [5, 1],      // madrugada
    [7, 0],              // amanhecer 5h-7h
    [17.5, 0],           // entardecer comeca ~17h30
    [19.5, 1],           // anoitece ~19h30
    [24, 1],
];

export function nightFactor(spHour) {
    const h = ((spHour % 24) + 24) % 24;
    for (let i = 1; i < CURVE.length; i++) {
        const [h1, f1] = CURVE[i - 1], [h2, f2] = CURVE[i];
        if (h <= h2) {
            const t = (h - h1) / (h2 - h1 || 1);
            return f1 + (f2 - f1) * Math.min(1, Math.max(0, t));
        }
    }
    return 1;
}

// Hora atual em Sao Paulo (UTC-3 fixo). ?tod=HH[:MM] sobrescreve p/ QA.
export function spHourNow() {
    try {
        const q = new URLSearchParams(location.search).get('tod');
        if (q != null) {
            const [hh, mm] = q.split(':').map(Number);
            return (hh || 0) + (mm || 0) / 60;
        }
    } catch { /* sem location */ }
    return (((Date.now() / 3600000) - 3) % 24 + 24) % 24;
}

// "Azul de ceu" do CP: o pack renderiza o ceu como azul saturado com canal
// R=0 (ex.: rgb(0,100,180)) — heuristica fixa falha. Melhor: referencia
// adaptativa = media dos pixels da faixa do topo do backdrop (ceU quase
// certo), e pixel e ceu se estiver perto dela E azulado.
function isSky(r, g, b, ref) {
    if (b <= r) return false; // ceu e azulado: azul domina o vermelho
    const dr = r - ref[0], dg = g - ref[1], db = b - ref[2];
    return dr * dr + dg * dg + db * db < 5625; // dist^2 < 75^2 (gradiente do ceu)
}

export default class NightOverlay {
    constructor(scene) {
        this.scene = scene;
        this.enabled = new URLSearchParams(location.search).get('night') !== '0';
        this.container = scene.add.container(0, 0).setDepth(8000000);

        // 1) multiply azul-escuro: escurece e joga o ciano do crepusculo
        this.tint = scene.add.rectangle(380, 240, 760, 480, 0x4a5f9e)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);
        // 2) veu normal quase-preto: profundidade extra de madrugada
        this.veil = scene.add.rectangle(380, 240, 760, 480, 0x05070f);
        // 3) ceu mascarado: estrelas + lua so onde ha ceu de verdade
        this.sky = scene.add.image(0, 0, '__MISSING').setOrigin(0, 0).setVisible(false);

        this.container.add([this.tint, this.veil, this.sky]);
        this.container.setVisible(false);
        this._skyCache = new Map(); // room -> Promise<texKey|null>
        this._room = null;
        this.update();
        // fator muda devagar — 1 checagem/min basta (transicao imperceptivel)
        scene.time.addEvent({ delay: 30000, loop: true, callback: () => this.update() });
    }

    update() {
        const room = this.scene.currentRoom;
        const f = this.enabled && NIGHT_ROOMS.has(room) ? nightFactor(spHourNow()) : 0;
        const show = f > 0.02;
        this.container.setVisible(show);
        this._room = room;
        if (!show) { this.sky.setVisible(false); return; }
        this.tint.setAlpha(Math.min(1, f * 1.15));
        this.veil.setAlpha(f * f * 0.55);          // quadratico: noite fechada pesa mais
        // estrelas/lua aparecem junto com a noite (alpha do fator);
        // esconde antes: a textura e por sala e a proxima mascara e async
        this.sky.setVisible(false);
        this._ensureSky(room).then((key) => {
            if (!key || this._room !== room || !this.container.visible) return;
            this.sky.setTexture(key).setAlpha(Math.min(1, f * 1.3));
            this.sky.setVisible(true);
        });
    }

    // Textura de ceu DA SALA (mascarada). Cache por sala+SS — a mascara
    // depende dos canvases rasterizados, que so existem apos _buildMovieLayers.
    _ensureSky(room) {
        const ss = this.scene._ss || 2;
        const cacheKey = `${room}|${ss}`;
        let p = this._skyCache.get(cacheKey);
        if (!p) {
            p = this._buildSkyTexture(room, ss).then((key) => {
                // sala ainda nao rasterizou (movieLayers vazio) ou falhou:
                // NAO cacheia — o proximo update (ex.: reveal) tenta de novo
                if (!key) this._skyCache.delete(cacheKey);
                return key;
            }).catch(() => { this._skyCache.delete(cacheKey); return null; });
            this._skyCache.set(cacheKey, p);
        }
        return p;
    }

    async _buildSkyTexture(room, ss) {
        const scene = this.scene;
        const layers = scene.movieLayers || [];
        if (!layers.length) return null;
        // backdrop = maior canvas (ceu+crao fundidos num segmento so)
        let back = null, backArea = 0;
        for (const l of layers) {
            const a = (l.canvas?.width || 0) * (l.canvas?.height || 0);
            if (a > backArea) { backArea = a; back = l; }
        }
        if (!back?.canvas || !backArea) return null;

        // --- mascara 380x240 (meio-pixel): branco so onde e ceu ---
        const MW = 380, MH = 240;
        const mask = document.createElement('canvas');
        mask.width = MW; mask.height = MH;
        const mg = mask.getContext('2d', { willReadFrequently: true });
        const bw = back.canvas.width, bh = back.canvas.height;
        const bdata = back.canvas.getContext('2d', { willReadFrequently: true })
            .getImageData(0, 0, bw, bh).data;
        // referencia de ceu: media da faixa superior (2%-6% da altura)
        let sr = 0, sg = 0, sb = 0, sn = 0;
        for (let cy = Math.floor(bh * 0.02); cy < bh * 0.06; cy += 4) {
            for (let cx = 0; cx < bw; cx += 8) {
                const i = (cy * bw + cx) * 4;
                if (bdata[i + 3] < 200) continue;
                sr += bdata[i]; sg += bdata[i + 1]; sb += bdata[i + 2]; sn++;
            }
        }
        const ref = sn ? [sr / sn, sg / sn, sb / sn] : [0, 100, 180];
        mg.fillStyle = '#fff';
        for (let my = 0; my < MH; my++) {
            const wy = my * 2;
            const cy = Math.round(wy * ss - back.oy);
            if (cy < 0 || cy >= bh) continue;
            for (let mx = 0; mx < MW; mx++) {
                const cx = Math.round(mx * 2 * ss - back.ox);
                if (cx < 0 || cx >= bw) continue;
                const i = (cy * bw + cx) * 4;
                if (isSky(bdata[i], bdata[i + 1], bdata[i + 2], ref)) mg.fillRect(mx, my, 1, 1);
            }
        }
        // outros segmentos/dynamics tambem ocluem: pinta de preto a area
        // deles na mascara (qualquer conteudo de sala nao e ceu)
        mg.fillStyle = '#000';
        mg.globalCompositeOperation = 'destination-out';
        const occluders = [...layers];
        for (const d of scene._dynList || []) {
            if (d.canvas) occluders.push({ canvas: d.canvas, ox: d.ox, oy: d.oy });
        }
        for (const l of occluders) {
            if (l === back || !l.canvas) continue;
            const x = (l.ox || 0) / ss / 2, y = (l.oy || 0) / ss / 2;
            const w = l.canvas.width / ss / 2, h = l.canvas.height / ss / 2;
            mg.fillRect(x, y, w, h);
        }
        mg.globalCompositeOperation = 'source-over';

        // --- textura base: estrelas + lua estilo Flash (pequena, glow) ---
        const c = document.createElement('canvas');
        c.width = 760; c.height = 480;
        const g = c.getContext('2d');
        // estrelas: concentradas no topo, fade ate ~60% da tela
        for (let i = 0; i < 120; i++) {
            const x = Math.random() * 760;
            const y = Math.pow(Math.random(), 1.7) * 290;
            const r = Math.random() < 0.8 ? 0.8 : 1.4;
            const fade = 1 - y / 320;
            g.globalAlpha = (0.2 + Math.random() * 0.6) * fade;
            g.fillStyle = '#e8f0ff';
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
        // lua: glow radial suave + nucleo brilhante pequeno (estilo Flash)
        const mx = 628, my = 62;
        const glow = g.createRadialGradient(mx, my, 4, mx, my, 46);
        glow.addColorStop(0, 'rgba(255,246,214,0.85)');
        glow.addColorStop(0.35, 'rgba(255,240,190,0.28)');
        glow.addColorStop(1, 'rgba(255,240,190,0)');
        g.globalAlpha = 1;
        g.fillStyle = glow;
        g.beginPath(); g.arc(mx, my, 46, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff8dc';
        g.beginPath(); g.arc(mx, my, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(220,205,150,0.45)';
        for (const [cx, cy, cr] of [[-5, -4, 3.5], [4, 5, 2.5], [0, 8, 2]]) {
            g.beginPath(); g.arc(mx + cx, my + cy, cr, 0, Math.PI * 2); g.fill();
        }

        // --- composita: ceu * mascara (destination-in usa o alpha da mascara) ---
        g.globalCompositeOperation = 'destination-in';
        g.globalAlpha = 1;
        g.drawImage(mask, 0, 0, 760, 480);

        const key = `night_sky_${room}_${ss}`;
        if (scene.textures.exists(key)) scene.textures.remove(key);
        scene.textures.addCanvas(key, c);
        return key;
    }
}
