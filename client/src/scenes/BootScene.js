/**
 * BootScene.js - Pré-carregador de Assets Autênticos do Club Penguin
 */

import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const { width, height } = this.scale;

        // Fundo azul marinho clássico de carregamento
        this.cameras.main.setBackgroundColor('#002b54');

        // Barra de carregamento visual Club Penguin
        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        progressBox.fillStyle(0x00172e, 0.8);
        progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 15, 320, 30, 8);
        progressBox.lineStyle(2, 0x0088ff, 1);
        progressBox.strokeRoundedRect(width / 2 - 160, height / 2 - 15, 320, 30, 8);

        const titleText = this.add.text(width / 2, height / 2 - 50, 'CLUB PENGUIN', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffcc00',
            stroke: '#002244',
            strokeThickness: 5
        }).setOrigin(0.5);

        const statusText = this.add.text(width / 2, height / 2 + 35, 'Carregando cenários da ilha...', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x00bfff, 1);
            progressBar.fillRoundedRect(width / 2 - 156, height / 2 - 11, 312 * value, 22, 6);
        });

        // Carrega todos os cenários clássicos extraídos
        const rooms = [
            'town', 'coffee', 'dance', 'pizza', 'plaza',
            'forts', 'dojo', 'beach', 'dock', 'lodge',
            'mine', 'rink'
        ];

        rooms.forEach((r) => {
            this.load.image(`room_${r}`, `/assets/rooms/${r}.png`);
        });

        // Carrega atlas de pinguins
        this.load.image('penguin_atlas', '/assets/penguin-atlas.png');

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            titleText.destroy();
            statusText.destroy();
            this.scene.start('RoomScene');
        });
    }

    create() {
        this.scene.start('RoomScene');
    }
}
