/**
 * Penguin.js - Entidade de Jogador Autêntica do Club Penguin
 * - Animação de waddle (marcha balançando clássica)
 * - Espelhamento direcional horizontal e ângulos
 * - Sombra, corpo vetorial colorido detalhado, nametag e balão de fala
 * - Depth sorting dinâmico (depth = y)
 */

import Phaser from 'phaser';

export default class Penguin extends Phaser.GameObjects.Container {
    constructor(scene, x, y, playerId, username = null, color = 0x0088ff) {
        super(scene, x, y);
        this.scene = scene;
        this.playerId = playerId;
        this.username = username || playerId;
        this.penguinColor = color;
        this.isMoving = false;
        this.moveTween = null;
        this.waddleTween = null;
        this.facingRight = true;

        // Container visual interno para permitir efeito de balanço (waddle) sem afetar a nametag
        this.bodyContainer = scene.add.container(0, 0);
        this.add(this.bodyContainer);

        // 1. Sombra suave no chão
        this.shadow = scene.add.ellipse(0, 0, 44, 16, 0x000000, 0.25);
        this.add(this.shadow);
        this.sendToBack(this.shadow);

        // 2. Desenho vetorial de alta definição do Pinguim Club Penguin
        this.avatarGraphics = scene.add.graphics();
        this.drawPenguin(this.avatarGraphics, this.penguinColor);
        this.bodyContainer.add(this.avatarGraphics);

        // 3. Etiqueta de Nome (Nametag)
        this.nameTag = scene.add.text(0, 10, this.username, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#002244',
            align: 'center',
            stroke: '#ffffff',
            strokeThickness: 3
        }).setOrigin(0.5, 0);
        this.add(this.nameTag);

        // 4. Balão de Chat Dinâmico
        this.chatBubble = scene.add.container(0, -78);
        this.chatBubble.setVisible(false);
        this.add(this.chatBubble);

        scene.add.existing(this);
        this.updateDepth();
    }

    drawPenguin(g, color) {
        g.clear();

        // Pés alaranjados
        g.fillStyle(0xff7700, 1);
        g.fillEllipse(-12, -2, 17, 8);
        g.fillEllipse(12, -2, 17, 8);

        // Corpo base (Azul / Cor do pinguim)
        g.fillStyle(color, 1);
        g.fillRoundedRect(-21, -52, 42, 50, 16);

        // Barriga branca em formato de gota Club Penguin
        g.fillStyle(0xffffff, 0.98);
        g.fillEllipse(0, -25, 27, 32);

        // Nadadeiras / Asas laterais
        g.fillStyle(color, 1);
        g.fillEllipse(-19, -30, 9, 22);
        g.fillEllipse(19, -30, 9, 22);

        // Bico alaranjado clássico
        g.fillStyle(0xff8800, 1);
        g.fillTriangle(-8, -38, 8, -38, 0, -30);

        // Olhos expressivos
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(-6, -42, 6, 8);
        g.fillEllipse(6, -42, 6, 8);

        // Pupilas pretas
        g.fillStyle(0x000000, 1);
        g.fillCircle(-5, -42, 2.5);
        g.fillCircle(5, -42, 2.5);
    }

    updateDepth() {
        this.setDepth(this.y);
    }

    moveTo(targetX, targetY, speed = 150) {
        if (this.moveTween) {
            this.moveTween.stop();
        }

        const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
        if (distance < 4) {
            this.stopWaddle();
            return;
        }

        // Determina orientação horizontal (esquerda ou direita)
        if (targetX < this.x && this.facingRight) {
            this.facingRight = false;
            this.bodyContainer.setScale(-1, 1);
        } else if (targetX > this.x && !this.facingRight) {
            this.facingRight = true;
            this.bodyContainer.setScale(1, 1);
        }

        const duration = (distance / speed) * 1000;
        this.isMoving = true;
        this.startWaddle();

        this.moveTween = this.scene.tweens.add({
            targets: this,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                this.updateDepth();
            },
            onComplete: () => {
                this.isMoving = false;
                this.stopWaddle();
                this.updateDepth();
            }
        });
    }

    startWaddle() {
        if (this.waddleTween) return;

        // Efeito de marcha balançando clássica de Club Penguin
        this.waddleTween = this.scene.tweens.add({
            targets: this.bodyContainer,
            angle: { from: -7, to: 7 },
            y: { from: 0, to: -3 },
            duration: 160,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    stopWaddle() {
        if (this.waddleTween) {
            this.waddleTween.stop();
            this.waddleTween = null;
        }
        this.bodyContainer.setAngle(0);
        this.bodyContainer.setY(0);
    }

    showChat(message) {
        this.chatBubble.removeAll(true);

        const textObj = this.scene.add.text(0, 0, message, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            color: '#111111',
            align: 'center',
            wordWrap: { width: 150 }
        }).setOrigin(0.5, 0.5);

        const padX = 12;
        const padY = 8;
        const width = Math.max(textObj.width + padX * 2, 45);
        const height = textObj.height + padY * 2;

        const bg = this.scene.add.graphics();
        bg.fillStyle(0xffffff, 0.96);
        bg.lineStyle(2, 0x003366, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);

        // Pontinha inferior do balão de fala
        bg.fillTriangle(
            -5, height / 2,
            5, height / 2,
            0, height / 2 + 7
        );

        this.chatBubble.add(bg);
        this.chatBubble.add(textObj);
        this.chatBubble.setVisible(true);

        if (this.chatTimer) this.chatTimer.remove();
        this.chatTimer = this.scene.time.delayedCall(5000, () => {
            this.chatBubble.setVisible(false);
        });
    }
}
