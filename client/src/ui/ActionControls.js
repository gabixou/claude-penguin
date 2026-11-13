/**
 * ActionControls.js - Controles de ação clássicos do Club Penguin (somente teclado)
 * D=dance, W=wave, S=sit/stand, T=throw(snowball), M=mapa
 * Sem botões visuais: gopenguin usa apenas hotkeys + dock inferior.
 */

import Phaser from 'phaser';

export default class ActionControls {
    constructor(scene, callbacks) {
        this.scene = scene;
        this.callbacks = callbacks || {};
        this.sitting = false;

        this._keyHandler = (event) => {
            if (event.repeat) return;
            switch ((event.key || '').toUpperCase()) {
                case 'D': this.emit('dance'); break;
                case 'W': this.emit('wave'); break;
                case 'S': this.toggleSit(); break;
                case 'T': this.emit('throw'); break;
                case 'M': this.emit('map'); break;
                case 'I': this.emit('clothes'); break;
            }
        };
        scene.input.keyboard.on('keydown', this._keyHandler);
    }

    emit(name) {
        if (this.callbacks.onAction) this.callbacks.onAction(name);
    }

    toggleSit() {
        this.sitting = !this.sitting;
        this.emit(this.sitting ? 'sit' : 'stand');
    }

    setSitting(bool) {
        this.sitting = !!bool;
    }

    destroy() {
        this.scene.input.keyboard.off('keydown', this._keyHandler);
    }
}
