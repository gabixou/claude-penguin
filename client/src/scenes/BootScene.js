/**
 * BootScene.js - Pré-carregador de Assets Autênticos do Club Penguin
 */

import Phaser from 'phaser';
import { PenguinLibrary } from '../entities/PenguinArt.js';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const { width, height } = this.scale;

        // Pack vetorial do pinguim (timelines.json + chunks SVG) — carrega em
        // paralelo com os demais assets; Penguin.js faz await da promise.
        this.game.penguinLibrary = PenguinLibrary.load();

        // Azul profundo do loader original (preenche enquanto o logo baixa)
        this.cameras.main.setBackgroundColor('#1a4f96');

        // Logo do projeto (wordmark CLUB PENGUIN) centralizado
        this.load.svg('logo', '/assets/ui/logo.svg', { width: 380, height: 380 * 777 / 1822 });

        // HUD web classico: icones/botoes do gopenguin.lol.
        for (let i = 2; i <= 10; i++) this.load.image(`hud_btn_${i}`, `/assets/hud/btn-${i}.png`);
        this.load.image('hud_map', '/assets/hud/map-icon.png');
        this.load.image('hud_mail', '/assets/hud/mail-icon.png');
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
        this.add.image(width / 2, height * 0.44, 'logo').setOrigin(0.5).setDisplaySize(430, 430 * 777 / 1822);

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

        // segura a tela o suficiente para o logo ser percebido; depois o
        // LoadingScreen do RoomScene continua o feedback durante a carga da sala
        this.time.delayedCall(1500, () => this.scene.start('RoomScene'));
    }
}
