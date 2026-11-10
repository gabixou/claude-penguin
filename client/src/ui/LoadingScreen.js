// Tela de loading (troca de salas) fiel ao Club Penguin original:
// fundo azul com vinheta radial, spinner = loader_arrows.gif autentico
// (DOM <img> para animacao nativa do GIF, sem pixelacao em tamanho nativo),
// barra de progresso fina abaixo e texto de status embaixo da barra.
import Phaser from 'phaser';

const WORLD_W = 760, WORLD_H = 480;
const DEPTH = 21000000;

export default class LoadingScreen extends Phaser.GameObjects.Container {
    constructor(scene) {
        super(scene, 0, 0);
        scene.add.existing(this);
        this.setDepth(DEPTH);
        this.setVisible(false);

        // fundo azul com vinheta radial (centro medio -> bordas escuras)
        const c = scene.textures.createCanvas('loader_bg', WORLD_W, WORLD_H);
        const cx = c.getContext();
        const g = cx.createRadialGradient(WORLD_W / 2, WORLD_H * 0.45, WORLD_H * 0.15, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.7);
        g.addColorStop(0, '#3f7ec4');
        g.addColorStop(0.6, '#1d5a9e');
        g.addColorStop(1, '#0c2c5e');
        cx.fillStyle = g;
        cx.fillRect(0, 0, WORLD_W, WORLD_H);
        c.refresh();
        this.add(scene.add.image(0, 0, 'loader_bg').setOrigin(0));

        // spinner DOM <img> (GIF animado nativo — asset original do CP)
        this._spinImg = null;

        // ---- Barra de progresso: retangulo fino, borda azul clara, fill branco ----
        const barW = 200, barH = 9, barX = WORLD_W / 2 - barW / 2, barY = 258;
        this._barTrack = scene.add.graphics();
        this._barTrack.fillStyle(0x9fc4ee, 0.9, 1);
        this._barTrack.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, (barH + 2) / 2);
        this._barTrack.fillStyle(0x0d2f66, 1);
        this._barTrack.fillRoundedRect(barX, barY, barW, barH, barH / 2);
        this.add(this._barTrack);
        this._barFill = scene.add.graphics();
        this.add(this._barFill);
        this._barX = barX; this._barY = barY; this._barW = barW; this._barH = barH;
        this._progress = 0;
        this._drawBar();

        // ---- Texto de status ("Joining Town...") abaixo da barra ----
        this._status = scene.add.text(WORLD_W / 2, 288, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px', color: '#ffffff',
        }).setOrigin(0.5);
        this.add(this._status);

        scene.scale.on('resize', () => this._layoutSpin());
    }

    // posiciona o GIF do spinner no centro do canvas escalado (DOM sobre o canvas)
    _layoutSpin() {
        if (!this._spinImg) return;
        const rect = this.scene.game.canvas.getBoundingClientRect();
        const sx = rect.width / WORLD_W, sy = rect.height / WORLD_H;
        const size = 56 * Math.min(sx, sy);
        Object.assign(this._spinImg.style, {
            position: 'fixed',
            left: (rect.left + WORLD_W / 2 * sx - size / 2) + 'px',
            top: (rect.top + 208 * sy - size / 2) + 'px',
            width: size + 'px',
            height: size + 'px',
            display: this.visible ? 'block' : 'none',
            zIndex: 30,
            pointerEvents: 'none',
        });
    }

    _ensureSpin() {
        if (this._spinImg) return;
        const img = document.createElement('img');
        img.src = '/assets/ui/loader_arrows.gif';
        img.alt = '';
        document.body.appendChild(img);
        this._spinImg = img;
        this._layoutSpin();
    }

    _drawBar() {
        this._barFill.clear();
        const w = this._progress * this._barW;
        if (w <= 0) return;
        this._barFill.fillStyle(0xffffff, 1);
        this._barFill.fillRoundedRect(this._barX, this._barY, Math.min(w, this._barW), this._barH, this._barH / 2);
    }

    setProgress(p) {
        this._progress = Math.max(0, Math.min(1, p));
        this._drawBar();
    }

    setStatus(text) {
        this._status.setText(text || '');
    }

    show(label = '', p = 0) {
        if (label) this._status.setText(label);
        this.setProgress(p);
        this.setVisible(true);
        this._ensureSpin();
        this._layoutSpin();
    }

    hide() {
        this.setVisible(false);
        if (this._spinImg) this._spinImg.style.display = 'none';
    }

    destroy(fromScene) {
        if (this._spinImg) { this._spinImg.remove(); this._spinImg = null; }
        super.destroy(fromScene);
    }
}
