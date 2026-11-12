/**
 * main.js - Configuração do Phaser 3 para o Club Penguin Browser Clone
 * Resolução nativa original de Club Penguin: 760 x 480
 */

// PRIMEIRO: dispara pack da sala, HUD, pinguim e WebSocket+login enquanto
// o resto (Phaser, fontes, evento load) ainda carrega.
import './preload.js';
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import RoomScene from './scenes/RoomScene.js';
import { WORLD_W, WORLD_H } from './display.js';
import { mark } from './perf.js';

// O jogo roda a 60fps cravados (as salas animam a 24fps do Flash por cima
// disso). Sem limite, monitores de 120/144Hz renderizavam 2-2.4x mais
// frames sem ganho visual nenhum.
const TARGET_FPS = 60;

// O limitador nativo do Phaser (stepLimitFPS) zera o acumulador a cada
// frame e exige delta >= 1000/60: num monitor de 60Hz o RAF entrega frames
// de 16.5-16.8ms, e os de 16.5 eram PULADOS (engasgo a ~30fps). Esta versao
// tem folga de 2ms para o jitter e carrega o saldo entre frames, entao a
// media fica em 60 tanto em 60Hz quanto em 120/144Hz. actualFps passa a
// contar so os frames realmente processados.
function installFrameLimiter() {
    const proto = Phaser.Core.TimeStep.prototype;
    proto.stepLimitFPS = function stepLimitFPS(time) {
        this.now = time;
        const raw = Math.max(0, time - this.lastTime);
        this.rawDelta = raw;
        this.time += raw;
        this.delta += this.smoothStep ? this.smoothDelta(raw) : raw;
        if (time >= this.nextFpsUpdate) this.updateFPS(time);
        this._budget = (this._budget || 0) + raw;
        const rate = this._limitRate;
        if (this._budget >= rate - 2) {
            this.framesThisSecond++;
            this.callback(time, this.delta);
            this.delta = 0;
            // saldo limitado a meio frame: atraso grande nao vira rajada
            this._budget = Math.max(-rate / 2, Math.min(this._budget - rate, rate / 2));
        }
        this.lastTime = time;
        this.frame++;
    };
}
installFrameLimiter();

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    // Backing inicial 1520x960; RoomScene ajusta para SS_FIXED (2.25x)
    // via computeSupersample() — mundo segue em coords 760x480 com camera zoom
    width: WORLD_W * 2,
    height: WORLD_H * 2,
    backgroundColor: '#001833',
    pixelArt: false,
    fps: {
        target: TARGET_FPS,
        limit: TARGET_FPS,
    },
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
    scene: [BootScene, RoomScene],
    callbacks: {
        postBoot: () => mark('phaser-booted'),
    },
};

window.addEventListener('load', () => {
    // Phaser Scale.FIT ja centraliza o canvas via margin; o flex do container
    // duplicava o centro (canvas deslocado ~41px para a direita)
    const gc = document.getElementById('game-container');
    if (gc) gc.style.display = 'block';
    const start = () => { mark('game-create'); window.__game = new Phaser.Game(config); };
    if (!document.fonts?.load) { start(); return; }
    Promise.race([
        document.fonts.load('12px GoPenguin'),
        new Promise((resolve) => setTimeout(resolve, 600))
    ]).then(start, start);
});
