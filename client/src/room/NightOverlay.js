// Ciclo dia/noite — Fase 1 (exploracao na branch dev3).
// Overlay global de "noite": multiply azul + véu escuro + estrelas/lua,
// aplicado ACIMA da sala e dos pinguins (depth 8M < HUD 10M) para escurecer
// o mundo inteiro sem tocar nos assets vetoriais. Interiors ficam de dia:
// tem iluminacao propria no pack.
//
// Horario: America/Sao_Paulo fixo em UTC-3 (sem horario de verao desde 2019).
// Para testar sem esperar a hora real: ?tod=22.5 (hora decimal) ou ?night=0
// para desligar. Quando o projeto tiver servidores por regiao, trocar
// spHourNow() por um fuso por servidor.
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

export default class NightOverlay {
    constructor(scene) {
        this.scene = scene;
        this.enabled = new URLSearchParams(location.search).get('night') !== '0';
        this.container = scene.add.container(0, 0).setDepth(8000000);

        // 1) multiply azul-escuro: escurece e joga o ciano do crepusculo.
        //    alpha = fator — o ramp de amanhecer/entardecer sai de graca.
        this.tint = scene.add.rectangle(380, 240, 760, 480, 0x4a5f9e)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);
        // 2) veu normal quase-preto por cima: profundidade extra de madrugada
        this.veil = scene.add.rectangle(380, 240, 760, 480, 0x05070f);
        // 3) ceu: estrelas + lua num canvas so (alpha = fator)
        this.sky = scene.add.image(0, 0, NightOverlay.skyTexture(scene))
            .setOrigin(0, 0);

        this.container.add([this.tint, this.veil, this.sky]);
        this.container.setVisible(false);
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
        if (!show) { this._room = room; return; }
        // tint multiply: alpha do multiply satura rapido; veil carrega o escuro
        this.tint.setAlpha(Math.min(1, f * 1.15));
        this.veil.setAlpha(f * f * 0.55);          // quadratico: noite fechada pesa mais
        this.sky.setAlpha(Math.min(1, f * 1.3));
        this._room = room;
    }

    // Textura unica do ceu noturno: estrelas (metade superior, densidade
    // variada) + lua cheia com crateras simples. Gerada 1x por sessao.
    static skyTexture(scene) {
        const key = 'night_sky';
        if (scene.textures.exists(key)) return key;
        const c = document.createElement('canvas');
        c.width = 760; c.height = 480;
        const g = c.getContext('2d');
        // estrelas — mais fortes no topo, sumindo perto do horizonte
        for (let i = 0; i < 110; i++) {
            const x = Math.random() * 760;
            const y = Math.pow(Math.random(), 1.6) * 330;
            const r = Math.random() < 0.85 ? 1 : 2;
            g.globalAlpha = 0.25 + Math.random() * 0.75 * (1 - y / 380);
            g.fillStyle = '#dfe8ff';
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
        // lua cheia simples + 3 crateras
        const mx = 640, my = 84, mr = 34;
        g.globalAlpha = 1;
        g.fillStyle = '#f4e9b8';
        g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(190,175,120,0.5)';
        for (const [cx, cy, cr] of [[-10, -6, 7], [8, 10, 5], [-2, 14, 4]]) {
            g.beginPath(); g.arc(mx + cx, my + cy, cr, 0, Math.PI * 2); g.fill();
        }
        scene.textures.addCanvas(key, c);
        return key;
    }
}
