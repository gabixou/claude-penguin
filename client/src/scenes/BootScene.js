/**
 * BootScene.js - Pré-carregador de Assets Autênticos do Club Penguin
 */

import Phaser from 'phaser';
import { PenguinLibrary } from '../entities/PenguinArt.js';
import { mark } from '../perf.js';
import { earlyPenguinLibrary, logoImage } from '../preload.js';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        mark('boot-preload');

        // Pack vetorial do pinguim (timelines.json + chunks SVG) — ja
        // disparado pelo preload.js antes do Phaser subir; Penguin.js faz
        // await da promise.
        this.game.penguinLibrary = earlyPenguinLibrary || PenguinLibrary.load();

        // Azul profundo do loader original (preenche enquanto o logo baixa)
        this.cameras.main.setBackgroundColor('#1a4f96');

        // Logo: pedido pelo preload.js como PRIMEIRO request (logoImage) e
        // rasterizado no create(). Os PNGs do HUD bitmap antigo (WebHud)
        // nao sao mais carregados: a HUD e a vetorial (VectorHud).
    }

    // SVG do logo (1822x777) -> canvas de 760px: nitido no boot (645px) e no
    // loader (322px) sem subir uma textura de 1822px para a GPU.
    _addLogoTexture() {
        if (this.textures.exists('logo')) return true;
        if (!logoImage.complete || !logoImage.naturalWidth) return false;
        const w = 760, h = Math.round(760 * 777 / 1822);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logoImage, 0, 0, w, h);
        this.textures.addCanvas('logo', c);
        return true;
    }

    create() {
        const { width, height } = this.scale;

        // Fundo azul profundo com vinheta radial (centro claro -> bordas escuras)
        const c = this.textures.createCanvas('boot_bg', width, height);
        const cx = c.getContext();
        const g = cx.createRadialGradient(width / 2, height * 0.42, height * 0.1, width / 2, height * 0.5, height * 0.75);
        g.addColorStop(0, '#2f6fb8');
        g.addColorStop(0.55, '#1a4f96');
        g.addColorStop(1, '#0a2c60');
        cx.fillStyle = g;
        cx.fillRect(0, 0, width, height);
        c.refresh();
        this.add.image(0, 0, 'boot_bg').setOrigin(0).setDepth(-2);

        // halo claro atras do wordmark azul (contraste sobre o azul escuro)
        const halo = this.add.graphics();
        halo.fillStyle(0xffffff, 0.14);
        halo.fillEllipse(width / 2, height * 0.44, 560, 190);
        halo.setDepth(-1);

        // Logo do projeto centralizado e em destaque (como no loader original)
        const showLogo = () => {
            if (this._addLogoTexture()) {
                this.add.image(width / 2, height * 0.44, 'logo').setOrigin(0.5).setDisplaySize(645, 645 * 777 / 1822);
            }
        };

        // Barra de progresso em capsula: container azul-escuro, icone circular
        // de setas a esquerda e preenchimento amarelo-alaranjado em gradiente.
        const capW = 240, capH = 26;
        const bx = width / 2 - capW / 2, by = height * 0.70;
        const cap = this.add.graphics();
        // corpo da capsula
        cap.fillStyle(0x0d2b5c, 1);
        cap.fillRoundedRect(bx, by, capW, capH, capH / 2);
        cap.lineStyle(2, 0x5f9bd8, 0.9);
        cap.strokeRoundedRect(bx, by, capW, capH, capH / 2);
        // icone circular com setas de rotacao (reload) dentro da capsula
        const icx = bx + capH / 2 + 2, icy = by + capH / 2;
        cap.fillStyle(0x1c4f96, 1);
        cap.fillCircle(icx, icy, 8.5);
        cap.lineStyle(1.6, 0xffffff, 1);
        cap.beginPath();
        cap.arc(icx, icy, 5.2, -0.6, Math.PI * 1.15);
        cap.strokePath();
        cap.beginPath();
        cap.moveTo(icx + 5.4, icy - 3.4);
        cap.lineTo(icx + 6.6, icy - 0.4);
        cap.lineTo(icx + 3.4, icy - 1.4);
        cap.closePath();
        cap.fillPath();
        cap.beginPath();
        cap.arc(icx, icy, 5.2, Math.PI - 0.6, Math.PI * 2.15);
        cap.strokePath();
        cap.beginPath();
        cap.moveTo(icx - 5.4, icy + 3.4);
        cap.lineTo(icx - 6.6, icy + 0.4);
        cap.lineTo(icx - 3.4, icy + 1.4);
        cap.closePath();
        cap.fillPath();
        // trilho interno da barra (a direita do icone)
        const trackX = bx + capH + 6, trackW = capW - capH - 12;
        cap.fillStyle(0x071a3d, 1);
        cap.fillRoundedRect(trackX, by + 5, trackW, capH - 10, (capH - 10) / 2);
        const fill = this.add.graphics();

        // progresso animado (o grosso do tempo e a sala carregando —
        // LoadingScreen do RoomScene assume dali em diante)
        let p = 0;
        this.time.addEvent({
            delay: 100,
            repeat: 200,
            callback: () => {
                p = Math.min(1, p + 0.008 + Math.random() * 0.02);
                fill.clear();
                if (p <= 0) return;
                const w = Math.max(10, (trackW - 4) * p);
                // gradiente amarelo->laranja do fill original
                fill.fillStyle(0xffc93c, 1);
                fill.fillRoundedRect(trackX + 2, by + 7, w, capH - 14, (capH - 14) / 2);
                fill.fillStyle(0xffdf7e, 0.55);
                fill.fillRoundedRect(trackX + 2, by + 7, w, (capH - 14) / 2.6, (capH - 14) / 2);
                if (p >= 1) this.time.removeAllEvents();
            }
        });

        // RoomScene assim que o logo existir: o LoadingScreen dela redesenha
        // esta MESMA tela (modo boot, precisa da textura 'logo') e mantem o
        // feedback durante a carga da sala — o antigo delayedCall(400) era
        // tempo morto puro. Se o logo demorar (>1.5s), segue sem ele: o
        // loader cai no modo azul e a sala nao espera.
        let started = false;
        const go = () => {
            if (started) return;
            started = true;
            mark('boot-done');
            showLogo();
            this.scene.start('RoomScene');
        };
        if (logoImage.complete) go();
        else {
            logoImage.decode().then(go, go);
            setTimeout(go, 1500);
        }
    }
}
