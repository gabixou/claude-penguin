// Tela de loading (troca de salas) fiel ao Club Penguin original:
// fundo azul com vinheta radial, spinner = loader_arrows.gif autentico
// (DOM <img> para animacao nativa do GIF, sem pixelacao em tamanho nativo),
// barra de progresso fina abaixo e texto de status embaixo da barra.
//
// Modo "boot": no load inicial mostra a MESMA tela do BootScene (logo
// claude penguin + capsula de progresso) em vez do loader azul — o boot
// inteiro (auth + raster da sala) fica sob o logo, sem tela intermediaria.
import Phaser from 'phaser';

const WORLD_W = 760, WORLD_H = 480;
const DEPTH = 21000000;

export default class LoadingScreen extends Phaser.GameObjects.Container {
    constructor(scene) {
        super(scene, 0, 0);
        scene.add.existing(this);
        this.setDepth(DEPTH);
        this.setVisible(false);
        this._mode = null;      // 'boot' | 'normal' | null
        this._progress = 0;
        this._bootDisp = 0;     // progresso exibido (lerp suave)
        this._bootTick = null;

        // ---- camada boot: replica do BootScene.create (mesmas texturas
        // 'boot_bg'/'logo' — escala 1520x960 -> mundo 760x480 = x0.5) ----
        this._boot = scene.add.container(0, 0);
        this._bootReady = scene.textures.exists('boot_bg') && scene.textures.exists('logo');
        if (this._bootReady) {
            const g = scene.add.graphics();
            // halo claro atras do wordmark (como no BootScene)
            g.fillStyle(0xffffff, 0.14);
            g.fillEllipse(WORLD_W / 2, WORLD_H * 0.44, 280, 95);
            this._boot.add(g);
            this._boot.add(scene.add.image(0, 0, 'boot_bg').setOrigin(0).setDisplaySize(WORLD_W, WORLD_H));
            this._boot.add(scene.add.image(WORLD_W / 2, WORLD_H * 0.44, 'logo')
                .setOrigin(0.5).setDisplaySize(322, 322 * 777 / 1822));

            // capsula de progresso (mesmo desenho do BootScene, x0.5)
            const capW = 120, capH = 13;
            const bx = WORLD_W / 2 - capW / 2, by = WORLD_H * 0.70;
            const cap = scene.add.graphics();
            cap.fillStyle(0x0d2b5c, 1);
            cap.fillRoundedRect(bx, by, capW, capH, capH / 2);
            cap.lineStyle(1, 0x5f9bd8, 0.9);
            cap.strokeRoundedRect(bx, by, capW, capH, capH / 2);
            const icx = bx + capH / 2 + 1, icy = by + capH / 2;
            cap.fillStyle(0x1c4f96, 1);
            cap.fillCircle(icx, icy, 4.25);
            cap.lineStyle(0.8, 0xffffff, 1);
            cap.beginPath();
            cap.arc(icx, icy, 2.6, -0.6, Math.PI * 1.15);
            cap.strokePath();
            cap.beginPath();
            cap.moveTo(icx + 2.7, icy - 1.7);
            cap.lineTo(icx + 3.3, icy - 0.2);
            cap.lineTo(icx + 1.7, icy - 0.7);
            cap.closePath();
            cap.fillPath();
            cap.beginPath();
            cap.arc(icx, icy, 2.6, Math.PI - 0.6, Math.PI * 2.15);
            cap.strokePath();
            cap.beginPath();
            cap.moveTo(icx - 2.7, icy + 1.7);
            cap.lineTo(icx - 3.3, icy + 0.2);
            cap.lineTo(icx - 1.7, icy + 0.7);
            cap.closePath();
            cap.fillPath();
            const trackX = bx + capH + 3, trackW = capW - capH - 6;
            cap.fillStyle(0x071a3d, 1);
            cap.fillRoundedRect(trackX, by + 2.5, trackW, capH - 5, (capH - 5) / 2);
            this._boot.add(cap);
            this._bootFill = scene.add.graphics();
            this._boot.add(this._bootFill);
            this._bootTrackX = trackX; this._bootTrackW = trackW;
            this._bootBarY = by + 3.5; this._bootBarH = capH - 7;
        }
        this._boot.setVisible(false);
        this.add(this._boot);

        // ---- camada normal: loader azul do Club Penguin (troca de salas) ----
        this._normal = scene.add.container(0, 0);

        // fundo azul com vinheta radial (centro medio -> bordas escuras)
        const c = scene.textures.createCanvas('loader_bg', WORLD_W, WORLD_H);
        const cx = c.getContext();
        const g2 = cx.createRadialGradient(WORLD_W / 2, WORLD_H * 0.45, WORLD_H * 0.15, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.7);
        g2.addColorStop(0, '#3f7ec4');
        g2.addColorStop(0.6, '#1d5a9e');
        g2.addColorStop(1, '#0c2c5e');
        cx.fillStyle = g2;
        cx.fillRect(0, 0, WORLD_W, WORLD_H);
        c.refresh();
        this._normal.add(scene.add.image(0, 0, 'loader_bg').setOrigin(0));

        // spinner DOM <img> (GIF animado nativo — asset original do CP)
        this._spinImg = null;

        // ---- Barra de progresso: retangulo fino, borda azul clara, fill branco ----
        const barW = 200, barH = 9, barX = WORLD_W / 2 - barW / 2, barY = 258;
        this._barTrack = scene.add.graphics();
        this._barTrack.fillStyle(0x9fc4ee, 0.9, 1);
        this._barTrack.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, (barH + 2) / 2);
        this._barTrack.fillStyle(0x0d2f66, 1);
        this._barTrack.fillRoundedRect(barX, barY, barW, barH, barH / 2);
        this._normal.add(this._barTrack);
        this._barFill = scene.add.graphics();
        this._normal.add(this._barFill);
        this._barX = barX; this._barY = barY; this._barW = barW; this._barH = barH;

        // ---- Texto de status ("Joining Town...") abaixo da barra ----
        this._status = scene.add.text(WORLD_W / 2, 288, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px', color: '#ffffff',
        }).setOrigin(0.5);
        this._normal.add(this._status);
        this.add(this._normal);

        this._drawBar();
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
            display: this.visible && this._mode === 'normal' ? 'block' : 'none',
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

    // barra da capsula do boot — fill amarelo->laranja com lerp suave
    // ate o progresso real (setProgress chega em rajadas durante o load)
    _drawBootBar() {
        if (!this._bootFill) return;
        this._bootDisp += (this._progress - this._bootDisp) * 0.12;
        if (Math.abs(this._progress - this._bootDisp) < 0.004) this._bootDisp = this._progress;
        this._bootFill.clear();
        const w = Math.max(4, (this._bootTrackW - 4) * this._bootDisp);
        this._bootFill.fillStyle(0xffc93c, 1);
        this._bootFill.fillRoundedRect(this._bootTrackX + 2, this._bootBarY, w, this._bootBarH, this._bootBarH / 2);
        this._bootFill.fillStyle(0xffdf7e, 0.55);
        this._bootFill.fillRoundedRect(this._bootTrackX + 2, this._bootBarY, w, this._bootBarH / 2.6, this._bootBarH / 2);
    }

    _ensureBootTick() {
        if (this._bootTick || !this._bootReady) return;
        this._bootTick = this.scene.time.addEvent({
            delay: 60, loop: true, callback: () => this._drawBootBar(),
        });
    }

    _stopBootTick() {
        if (this._bootTick) { this._bootTick.remove(); this._bootTick = null; }
    }

    setProgress(p) {
        this._progress = Math.max(0, Math.min(1, p));
        this._drawBar();
    }

    setStatus(text) {
        this._status.setText(text || '');
    }

    // modo boot: tela do logo ate a sala abrir (load inicial)
    showBoot() {
        if (!this._bootReady) { this.show('', this._progress); return; }
        this._mode = 'boot';
        this._normal.setVisible(false);
        this._boot.setVisible(true);
        this.setVisible(true);
        this._ensureBootTick();
    }

    show(label = '', p = 0) {
        this._mode = 'normal';
        this._stopBootTick();
        this._boot.setVisible(false);
        this._normal.setVisible(true);
        if (label) this._status.setText(label);
        this.setProgress(p);
        this.setVisible(true);
        this._ensureSpin();
        this._layoutSpin();
    }

    hide() {
        this._mode = null;
        this._stopBootTick();
        this.setVisible(false);
        if (this._spinImg) this._spinImg.style.display = 'none';
    }

    destroy(fromScene) {
        this._stopBootTick();
        if (this._spinImg) { this._spinImg.remove(); this._spinImg = null; }
        super.destroy(fromScene);
    }
}
