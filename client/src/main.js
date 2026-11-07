/**
 * main.js - Configuração do Phaser 3 para o Club Penguin Browser Clone
 * Resolução nativa original de Club Penguin: 760 x 480
 */

import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import RoomScene from './scenes/RoomScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 760,
    height: 480,
    backgroundColor: '#001833',
    pixelArt: false,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, RoomScene]
};

window.addEventListener('load', () => {
    new Phaser.Game(config);
});
