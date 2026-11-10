// HUD inferior fiel ao GoPenguin 3DS (ui_theme.c + bottom() do main.c).
// Desenha o layout logico 320x240 escalado para caber na base do canvas 760x480.
import Phaser from 'phaser';

const INK = 0x003366, SHADOW = 0x0b3d6e, CARD_STROKE = 0x9fd6f5;
const BTN_TOP = 0x086aa6, BTN_BOTTOM = 0x064679;
const W = 320, H = 240;

const lerpColor = (a, b, t) => {
    const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
    const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
};

function vgrad(g, x, y, w, h, top, bottom, steps = 10) {
    for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        g.fillStyle(lerpColor(top, bottom, (t0 + t1) / 2), 1);
        g.fillRect(x, y + h * t0, w, h / steps + 1);
    }
}
function rrect(g, x, y, w, h, r, color, alpha = 1) {
    g.fillStyle(color, alpha); g.fillRoundedRect(x, y, w, h, r);
}
// uiButton fiel: sombra + corpo branco + gradiente azul + brilho
function drawButton(g, x, y, w, h, pressed = false, enabled = true) {
    const r = Math.min(8, h / 2.6);
    if (!enabled) {
        rrect(g, x, y + 1, w, h, r, SHADOW, 0.16);
        rrect(g, x, y, w, h, r, 0xffffff);
        rrect(g, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(1, r - 1), 0xc9dce8);
        return;
    }
    if (!pressed) rrect(g, x, y + 2, w, h, r, SHADOW, 0.35);
    const dy = pressed ? 1 : 0;
    rrect(g, x, y + dy, w, h, r, 0xffffff);
    // gradiente interno
    const ix = x + 1.5, iy = y + 1.5 + dy, iw = w - 3, ih = h - 3;
    const ir = Math.max(1, r - 1.5);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        g.fillStyle(lerpColor(BTN_TOP, BTN_BOTTOM, t), 1);
        const sy = iy + ih * i / steps, sh = ih / steps + 1;
        if (i === 0) g.fillRoundedRect(ix, sy, iw, sh + ir, { tl: ir, tr: ir, bl: 0, br: 0 });
        else if (i === steps - 1) g.fillRoundedRect(ix, sy, iw, sh + ir, { tl: 0, tr: 0, bl: ir, br: ir });
        else g.fillRect(ix, sy, iw, sh);
    }
    if (!pressed && h >= 14) rrect(g, x + 4, y + 3, w - 8, (h - 6) * 0.42, Math.min(r, (h - 6) * 0.21), 0xffffff, 0.06);
}
// uiBox: fill branco = card com stroke; 0x0085c7 = botao; INK = barra escura
function drawBox(g, x, y, w, h, fill, down = false) {
    const r = Math.min(7, h / 3);
    if (fill === 0x0085c7) { drawButton(g, x, y, w, h, down, true); return; }
    if (fill === 0xffffff) {
        rrect(g, x, y + 1.5, w, h, r, SHADOW, 0.13);
        rrect(g, x, y, w, h, r, down ? 0x4fc0ff : CARD_STROKE);
        rrect(g, x + 1, y + 1, w - 2, h - 2, Math.max(1, r - 1), down ? 0xe2f5ff : 0xffffff);
        return;
    }
    if (fill === INK || fill === 0x006699) {
        rrect(g, x, y + 1, w, h, r, SHADOW, 0.24);
        vgrad(g, x, y, w, h, fill === INK ? 0x0b5a99 : 0x075c99, fill === INK ? 0x062f57 : 0x063c68);
        return;
    }
    rrect(g, x, y, w, h, Math.min(r, 4), lerpColor(fill, 0x000000, 0.35));
    rrect(g, x + 1, y + 1, w - 2, h - 2, Math.max(1, Math.min(r, 4) - 1), fill);
}

const FLAKES = [[18,46,2],[61,120,1],[97,70,2],[140,160,1],[176,52,1],[214,128,2],[251,84,1],[292,170,2],[38,182,1],[120,196,2],[230,190,1],[300,40,1],[160,98,1],[80,150,1]];
const TABS = ['Room', 'Map', 'Me', 'People', 'Help'];
const TAB_ICONS = [6, 8, 4, 5, 7];
const ACTIONS = [
    { id: 'wave', label: 'Wave' }, { id: 'dance', label: 'Dance' }, { id: 'sit', label: 'Sit' },
    { id: 'snowball', label: 'Snowball', icon: 3 }, { id: 'chat', label: 'Chat', icon: 0 }, { id: 'zoom', label: 'Zoom', icon: 6 },
];

export default class GoPenguinHud extends Phaser.GameObjects.Container {
    constructor(scene) {
        super(scene, 0, 0);
        const panelH = 150;
        this.scaleX = (scene.scale.width - 20) / W;
        this.scaleY = panelH / H;
        this.scaleFactor = this.scaleY;
        this.setScale(this.scaleX, this.scaleY);
        this.setPosition((scene.scale.width - W * this.scaleX) / 2, scene.scale.height - H * this.scaleY - 6);
        this.panelHeight = H * this.scaleY;
        this._cbs = { action: null, tab: null, say: null };
        this.activeTab = 'room';
        this._build(scene);
        scene.add.existing(this);
    }

    _g() { const g = this.scene.add.graphics(); this.add(g); return g; }

    _build(scene) {
        const g = this._g();
        // ---- ui_background: gradiente + flocos ----
        vgrad(g, 0, 0, W, H, 0xcdeeff, 0xf4fbff, 12);
        for (const [fx, fy, fr] of FLAKES) { g.fillStyle(0xffffff, 0.78); g.fillCircle(fx, fy, fr); }

        // ---- ui_header ----
        rrect(g, 0, 0, W, 29, 0, SHADOW, 0.24);
        vgrad(g, 0, 0, W, 27, 0x075c99, 0x063c68, 8);
        g.fillStyle(0x7fd2ff, 1); g.fillRect(0, 0, W, 1);
        g.fillStyle(0xffffff, 1); g.fillCircle(14, 13.5, 11);
        g.fillStyle(0xdff3ff, 1); g.fillCircle(14, 13.5, 10);
        // micro-logo: retangulos brancos simples no disco
        g.fillStyle(0x086aa6, 1); g.fillRect(10, 10, 8, 7);
        this.roomTitle = scene.add.text(34, 8, '', { fontFamily: 'GoPenguin', fontSize: '15px', color: '#ffffff' });
        this.add(this.roomTitle);

        // ---- tab bar (desenhada por ultimo, por cima) ----
        this._drawTabs(g);

        // ================= TAB ROOM =================
        // minimap box + label
        drawBox(g, 6, 33, 181, 119, 0xffffff);
        g.fillStyle(0x0a5b9f, 1); g.fillRect(9, 36, 175, 110);
        this.minimapHint = scene.add.text(60, 80, 'MAP', { fontFamily: 'GoPenguin', fontSize: '12px', color: '#9fd6f5' });
        this.add(this.minimapHint);
        scene.add.text(0, 0, '', { fontFamily: 'GoPenguin' }); // noop keep

        // 6 botoes de acao
        this.actionZones = [];
        ACTIONS.forEach((a, i) => {
            const x = 193 + (i % 2) * 62, y = 34 + Math.floor(i / 2) * 34;
            const zone = this._zone(x, y, 59, 32, () => this._cbs.action && this._cbs.action(a.id));
            if (!a.icon) this._penguinPreview(g, x, y);
            else {
                drawButton(g, x, y, 59, 32);
                const ic = scene.add.image(x + 29.5, y + 9, 'ui_icons', a.icon).setScale(0.45);
                this.add(ic);
            }
            const lb = scene.add.text(x + 29.5, y + 25, a.label, { fontFamily: 'GoPenguin', fontSize: '11px', color: '#ffffff' }).setOrigin(0.5);
            this.add(lb);
            this.actionZones.push(zone);
        });

        // Membership (desabilitado)
        drawButton(g, 193, 139, 121, 26, false, false);
        const mIcon = scene.add.image(198, 140, 'ui_icons', 9).setScale(0.75); this.add(mIcon);
        const mLabel = scene.add.text(270, 152, 'Membership', { fontFamily: 'GoPenguin', fontSize: '11px', color: '#003366' }).setOrigin(0.5); this.add(mLabel);
        this._zone(193, 139, 121, 26, () => {});

        // Say something bar
        drawBox(g, 7, 173, 240, 28, 0xffffff);
        const sIcon = scene.add.image(10, 174, 'ui_icons', 0).setScale(0.8); this.add(sIcon);
        const sText = scene.add.text(41, 179, 'Say something...', { fontFamily: 'GoPenguin', fontSize: '11px', color: '#003366' }); this.add(sText);
        drawButton(g, 253, 173, 60, 28);
        const iglooLabel = scene.add.text(283, 186, 'Igloo', { fontFamily: 'GoPenguin', fontSize: '11px', color: '#ffffff' }).setOrigin(0.5); this.add(iglooLabel);
        this._zone(253, 173, 60, 28, () => this._cbs.say && this._cbs.say());
        this.sayZone = this._zone(7, 173, 240, 28, () => this._cbs.say && this._cbs.say());
    }

    _drawTabs(g) {
        vgrad(g, 0, 205, W, 35, 0x0d4a85, 0x062646, 8);
        g.fillStyle(0x4fc0ff, 0.7); g.fillRect(0, 205, W, 1);
        this.tabZones = [];
        this._tabObjs = [];
        TABS.forEach((name, i) => {
            const x = i * 64 + 2, y = 208, w = 60, h = 30;
            const active = this.activeTab === name.toLowerCase();
            if (active) drawButton(g, x, y, w, h, false, true);
            const iconSize = 32 * 0.62, gap = 2;
            const label = this.scene.add.text(0, 0, name, { fontFamily: 'GoPenguin', fontSize: '10px' });
            const lw = label.width; label.destroy();
            const group = iconSize + gap + lw, gx = x + (w - group) / 2, mid = 223;
            const ic = this.scene.add.image(gx, mid - iconSize / 2, 'ui_icons', TAB_ICONS[i]).setScale(iconSize / 32);
            const tx = this.scene.add.text(gx + iconSize + gap, mid - 5, name, { fontFamily: 'GoPenguin', fontSize: '10px', color: active ? '#ffdd33' : '#ffffff' });
            this.add([ic, tx]);
            this._tabObjs.push(ic, tx);
            this.tabZones.push(this._zone(x, y, w, h, () => this._setTab(name.toLowerCase())));
        });
    }

    _setTab(name) {
        this.activeTab = name;
        this.tabZones.forEach(z => z.destroy());
        this.tabZones = [];
        this._tabObjs.forEach(o => o.destroy());
        this._tabObjs = [];
        if (!this._tabG) this._tabG = this._g();
        this._tabG.clear();
        this._drawTabs(this._tabG);
        if (this._cbs.tab) this._cbs.tab(this.activeTab);
    }

    _penguinPreview(g, x, y) {
        const cx = x + 29.5, cy = y + 16;
        drawButton(g, x, y, 59, 32);
        // preview estilizado: corpo escuro + barriga branca + cabeca
        g.fillStyle(0x0a3d6e, 1); g.fillEllipse(cx, cy + 5, 24, 26);
        g.fillStyle(0xffffff, 1); g.fillEllipse(cx, cy + 9, 15, 18);
        g.fillStyle(0x0a3d6e, 1); g.fillCircle(cx, cy - 7, 8);
        g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy - 9, 4.5);
        g.fillStyle(0xf5a623, 1); g.fillTriangle(cx - 3.5, cy - 7, cx + 3.5, cy - 7, cx, cy - 3.5);
    }

    _zone(x, y, w, h, cb) {
        const z = this.scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        z.on('pointerdown', cb);
        this.add(z);
        return z;
    }

    setRoomTitle(t) { if (this.roomTitle) this.roomTitle.setText(t || ''); }
    onAction(cb) { this._cbs.action = cb; }
    onTabChange(cb) { this._cbs.tab = cb; }
    onSaySomething(cb) { this._cbs.say = cb; }
    setActiveTab(name) { if (this.activeTab !== name) this._setTab(name); }

    // rect da say-bar em coordenadas de TELA (para posicionar input DOM)
    sayBarScreenRect() {
        return { x: this.x + 7 * this.scaleX, y: this.y + 173 * this.scaleY, w: 240 * this.scaleX, h: 28 * this.scaleY };
    }
}
