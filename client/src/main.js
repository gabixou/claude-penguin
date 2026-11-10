/**
 * main.js - Configuração do Phaser 3 para o Club Penguin Browser Clone
 * Resolução nativa original de Club Penguin: 760 x 480
 */

import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import RoomScene from './scenes/RoomScene.js';
import { WORLD_W, WORLD_H } from './display.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    // Backing inicial 1520x960; RoomScene ajusta para SS_FIXED (2.25x)
    // via computeSupersample() — mundo segue em coords 760x480 com camera zoom
    width: WORLD_W * 2,
    height: WORLD_H * 2,
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
    // Phaser Scale.FIT ja centraliza o canvas via margin; o flex do container
    // duplicava o centro (canvas deslocado ~41px para a direita)
    const gc = document.getElementById('game-container');
    if (gc) gc.style.display = 'block';
    const start = () => { window.__game = new Phaser.Game(config); };
    if (!document.fonts?.load) { start(); return; }
    Promise.race([
        document.fonts.load('12px GoPenguin'),
        new Promise((resolve) => setTimeout(resolve, 600))
    ]).then(start, start);
});
